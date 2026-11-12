//! Transferencias de archivos hechas en Rust, en streaming y sin pasar el
//! contenido completo por el webview:
//!
//! - `upload_files`: sube archivos del disco (rutas del drag & drop) al servidor.
//! - `download_file`: descarga un archivo del servidor a `Descargas/SrvFiles`.
//! - `begin_receive` / `append_receive` / `finish_receive`: escribe en disco
//!   los chunks de una transferencia P2P a medida que llegan.
//!
//! Los nombres que vienen de la red se sanean (solo el último componente, sin
//! caracteres reservados) y nunca se sobrescribe: se agrega " (n)".
//!
//! `Descargas/SrvFiles` es también la carpeta que comparte el servidor interno
//! (ver `lib.rs`): lo recibido aparece en la lista de archivos. Mientras se
//! escribe, el archivo tiene un nombre temporal oculto que el servidor no
//! lista, y se publica con su nombre real al terminar.

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

const SUBFOLDER: &str = "SrvFiles";

/// Prefijo de los archivos en curso. Es el mismo que usa el backend Go para
/// sus subidas: no los lista ni permite descargarlos.
const TEMP_PREFIX: &str = ".srvfiles-upload-";

#[derive(Default)]
pub struct Transfers {
    cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
    receives: Mutex<HashMap<String, Receive>>,
}

struct Receive {
    file: File,
    tmp: PathBuf,
    name: String,
}

#[derive(Clone, Serialize)]
struct Progress<'a> {
    id: &'a str,
    loaded: u64,
    total: u64,
}

// ─── Names & paths ───────────────────────────────────────────────────────────

/// Comprueba si un archivo debe considerarse oculto en Unix/macOS o Windows:
/// archivos que empiezan con '.', archivos de sistema de Windows (desktop.ini,
/// thumbs.db) o con atributos HIDDEN / SYSTEM en Windows.
pub fn is_hidden(name: &str, meta: Option<&std::fs::Metadata>) -> bool {
    if name.starts_with('.') {
        return true;
    }
    let lower = name.to_ascii_lowercase();
    if lower == "desktop.ini" || lower == "thumbs.db" {
        return true;
    }
    #[cfg(windows)]
    if let Some(m) = meta {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
        if m.file_attributes() & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0 {
            return true;
        }
    }
    let _ = meta;
    false
}

/// Nombre seguro: último componente, sin control ni reservados de Windows,
/// sin puntos/espacios en los extremos.
pub fn sanitize_file_name(name: &str) -> String {
    let last = name.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = last
        .chars()
        .map(|c| if c.is_control() || ":*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() {
        "archivo".to_string()
    } else {
        trimmed.to_string()
    }
}

/// `Descargas/SrvFiles`: destino de descargas y recepciones, y carpeta del servidor interno.
pub fn downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?.join(SUBFOLDER);
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Nombres candidatos para `name` en orden: "a.txt", "a (1).txt", "a (2).txt"…
fn candidate_names(name: &str) -> impl Iterator<Item = String> {
    let safe = sanitize_file_name(name);
    let (stem, ext) = match safe.rfind('.') {
        Some(i) if i > 0 => (safe[..i].to_string(), safe[i..].to_string()),
        _ => (safe.clone(), String::new()),
    };
    (0..10_000).map(move |n| if n == 0 { safe.clone() } else { format!("{stem} ({n}){ext}") })
}

/// Crea un archivo temporal oculto en `dir` para escribir algo en curso.
fn create_temp(dir: &Path) -> Result<(File, PathBuf), String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    for n in 0..1_000 {
        let path = dir.join(format!("{TEMP_PREFIX}{nanos:x}-{n}"));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((file, path)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("No se pudo crear el archivo: {e}")),
        }
    }
    Err("No se pudo crear un archivo temporal".into())
}

/// Publica `tmp` en `dir` con el primer nombre libre (nunca sobrescribe).
/// Usa un hard link, que falla si el nombre existe; en sistemas de archivos
/// sin hard links (FAT/exFAT) cae a renombrar.
fn publish(tmp: &Path, dir: &Path, name: &str) -> Result<PathBuf, String> {
    for candidate in candidate_names(name) {
        let path = dir.join(&candidate);
        match std::fs::hard_link(tmp, &path) {
            Ok(()) => {
                let _ = std::fs::remove_file(tmp);
                return Ok(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) if !path.exists() => {
                std::fs::rename(tmp, &path).map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;
                return Ok(path);
            }
            Err(_) => continue,
        }
    }
    Err("No hay un nombre libre para el archivo".into())
}

/// Mueve a `to` los archivos que quedaron en la carpeta que usaba el servidor
/// antes (datos de la app), para que sigan apareciendo en la lista.
pub fn migrate_legacy_uploads(from: &Path, to: &Path) {
    let Ok(entries) = std::fs::read_dir(from) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        if is_hidden(&name, meta.as_ref()) || !entry.path().is_file() {
            continue;
        }
        let src = entry.path();
        let moved = candidate_names(&name).map(|c| to.join(c)).find(|p| !p.exists()).and_then(|dest| {
            std::fs::rename(&src, &dest)
                .or_else(|_| std::fs::copy(&src, &dest).and_then(|_| std::fs::remove_file(&src)))
                .ok()
                .map(|_| dest)
        });
        match moved {
            Some(dest) => log::info!("Archivo movido a la carpeta compartida: {dest:?}"),
            None => log::warn!("No se pudo mover {src:?} a {to:?}"),
        }
    }
    let _ = std::fs::remove_file(from.join(".gitkeep"));
    let _ = std::fs::remove_dir(from); // solo si quedó vacía
}

fn register_cancel(state: &Transfers, id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    state.cancel.lock().unwrap().insert(id.to_string(), flag.clone());
    flag
}

fn unregister_cancel(state: &Transfers, id: &str) {
    state.cancel.lock().unwrap().remove(id);
}

#[derive(Serialize)]
pub struct PathInfo {
    path: String,
    name: String,
    size: u64,
}

/// Nombre y tamaño de archivos arrastrados a la ventana (para mostrarlos y
/// validar el límite antes de subir). Omite directorios y rutas ilegibles.
#[tauri::command]
pub fn path_info(paths: Vec<String>) -> Vec<PathInfo> {
    paths
        .into_iter()
        .filter_map(|p| {
            // No se filtran los archivos ocultos: el servidor ya limpia el
            // nombre al guardar (".env" → "env"), igual que en el navegador.
            let meta = std::fs::metadata(&p).ok()?;
            if !meta.is_file() {
                return None;
            }
            let name = Path::new(&p).file_name()?.to_string_lossy().to_string();
            Some(PathInfo { path: p, name, size: meta.len() })
        })
        .collect()
}

/// Cancela una subida o descarga en curso.
#[tauri::command]
pub fn cancel_transfer(state: State<'_, Transfers>, id: String) {
    if let Some(flag) = state.cancel.lock().unwrap().get(&id) {
        flag.store(true, Ordering::SeqCst);
    }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/// Sube `paths` a `url` (POST multipart, campo "files") con el token de
/// sesión. Emite "upload-progress" y devuelve la respuesta JSON del servidor.
#[tauri::command]
pub async fn upload_files(
    app: AppHandle,
    state: State<'_, Transfers>,
    url: String,
    token: Option<String>,
    paths: Vec<String>,
    id: String,
) -> Result<serde_json::Value, String> {
    let cancel = register_cancel(&state, &id);
    let result = do_upload(&app, &url, token, &paths, &id, cancel).await;
    unregister_cancel(&state, &id);
    result
}

async fn do_upload(
    app: &AppHandle,
    url: &str,
    token: Option<String>,
    paths: &[String],
    id: &str,
    cancel: Arc<AtomicBool>,
) -> Result<serde_json::Value, String> {
    let mut total: u64 = 0;
    for p in paths {
        total += tokio::fs::metadata(p).await.map_err(|e| format!("No se pudo leer {p}: {e}"))?.len();
    }
    let loaded = Arc::new(std::sync::atomic::AtomicU64::new(0));

    let mut form = reqwest::multipart::Form::new();
    for p in paths {
        let file = tokio::fs::File::open(p).await.map_err(|e| format!("No se pudo abrir {p}: {e}"))?;
        let len = file.metadata().await.map_err(|e| e.to_string())?.len();
        let name = Path::new(p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "archivo".into());
        let (app, loaded, cancel, id) = (app.clone(), loaded.clone(), cancel.clone(), id.to_string());
        let stream = ReaderStream::with_capacity(file, 256 * 1024).map(move |chunk| {
            if cancel.load(Ordering::SeqCst) {
                return Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "cancelled"));
            }
            if let Ok(bytes) = &chunk {
                let now = loaded.fetch_add(bytes.len() as u64, Ordering::SeqCst) + bytes.len() as u64;
                let _ = app.emit("upload-progress", Progress { id: &id, loaded: now, total });
            }
            chunk
        });
        let part = reqwest::multipart::Part::stream_with_length(reqwest::Body::wrap_stream(stream), len).file_name(name);
        form = form.part("files", part);
    }

    let client = reqwest::Client::new();
    let mut req = client.post(url).multipart(form);
    if let Some(t) = token {
        req = req.header("X-SrvFiles-Token", t);
    }
    let resp = req.send().await.map_err(|e| {
        if cancel.load(Ordering::SeqCst) { "cancelled".to_string() } else { format!("Error de red: {e}") }
    })?;
    let status = resp.status();
    let bytes = resp.bytes().await.unwrap_or_default();
    let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    if status.as_u16() == 401 {
        return Err("unauthorized".into());
    }
    if !status.is_success() {
        let msg = body.get("error").and_then(|e| e.as_str()).unwrap_or("Error del servidor");
        return Err(format!("{msg} ({})", status.as_u16()));
    }
    Ok(body)
}

// ─── Download ────────────────────────────────────────────────────────────────

/// Descarga `url` a `Descargas/SrvFiles/<file_name>` sin sobrescribir.
/// Emite "download-progress" y devuelve la ruta final.
#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    state: State<'_, Transfers>,
    url: String,
    token: Option<String>,
    file_name: String,
    id: String,
) -> Result<String, String> {
    let cancel = register_cancel(&state, &id);
    let result = do_download(&app, &url, token, &file_name, &id, cancel).await;
    unregister_cancel(&state, &id);
    result
}

async fn do_download(
    app: &AppHandle,
    url: &str,
    token: Option<String>,
    file_name: &str,
    id: &str,
    cancel: Arc<AtomicBool>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.get(url);
    if let Some(t) = token {
        req = req.header("X-SrvFiles-Token", t);
    }
    let resp = req.send().await.map_err(|e| format!("Error de red: {e}"))?;
    if resp.status().as_u16() == 401 {
        return Err("unauthorized".into());
    }
    if !resp.status().is_success() {
        return Err(format!("El servidor respondió {}", resp.status().as_u16()));
    }
    let total = resp.content_length().unwrap_or(0);

    let dir = downloads_dir(app)?;
    let (file, tmp) = create_temp(&dir)?;
    let mut out = tokio::fs::File::from_std(file);
    let mut stream = resp.bytes_stream();
    let mut loaded: u64 = 0;

    let outcome: Result<(), String> = async {
        while let Some(chunk) = stream.next().await {
            if cancel.load(Ordering::SeqCst) {
                return Err("cancelled".into());
            }
            let bytes = chunk.map_err(|e| format!("Error de red: {e}"))?;
            out.write_all(&bytes).await.map_err(|e| format!("No se pudo escribir: {e}"))?;
            loaded += bytes.len() as u64;
            let _ = app.emit("download-progress", Progress { id, loaded, total });
        }
        out.flush().await.map_err(|e| e.to_string())
    }
    .await;

    drop(out);
    let published = outcome.and_then(|()| publish(&tmp, &dir, file_name));
    match published {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            Err(e)
        }
    }
}

// ─── Carpeta compartida ──────────────────────────────────────────────────────

/// Muestra `file_name` de `Descargas/SrvFiles` en el explorador del sistema.
/// Lo usa la app cuando ve su propio servidor: el archivo ya está en el
/// disco, descargarlo de nuevo solo crearía una copia.
#[tauri::command]
pub fn show_in_folder(app: AppHandle, file_name: String) -> Result<(), String> {
    if is_hidden(&file_name, None) || file_name.starts_with(TEMP_PREFIX) || sanitize_file_name(&file_name) != file_name {
        return Err("nombre inválido".into());
    }
    let dir = downloads_dir(&app)?;
    let path = dir.join(&file_name);
    let meta = match std::fs::metadata(&path) {
        Ok(m) if m.is_file() => m,
        _ => return Err("El archivo ya no existe".into()),
    };
    if is_hidden(&file_name, Some(&meta)) {
        return Err("nombre inválido".into());
    }
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg("-R").arg(&path).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer").arg(format!("/select,{}", path.display())).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&dir).spawn();
    result.map(|_| ()).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

// ─── P2P receive ─────────────────────────────────────────────────────────────

/// Prepara la recepción P2P en un temporal oculto. Devuelve la carpeta de destino.
#[tauri::command]
pub fn begin_receive(app: AppHandle, state: State<'_, Transfers>, id: String, file_name: String) -> Result<String, String> {
    let dir = downloads_dir(&app)?;
    let (file, tmp) = create_temp(&dir)?;
    state.receives.lock().unwrap().insert(id, Receive { file, tmp, name: file_name });
    Ok(dir.to_string_lossy().to_string())
}

/// Agrega un chunk (cuerpo binario crudo, cabecera `x-receive-id`).
#[tauri::command]
pub fn append_receive(request: Request<'_>, state: State<'_, Transfers>) -> Result<(), String> {
    let id = request
        .headers()
        .get("x-receive-id")
        .and_then(|v| v.to_str().ok())
        .ok_or("falta x-receive-id")?
        .to_string();
    let InvokeBody::Raw(data) = request.body() else {
        return Err("se esperaba un cuerpo binario".into());
    };
    let mut receives = state.receives.lock().unwrap();
    let rec = receives.get_mut(&id).ok_or("recepción desconocida")?;
    rec.file.write_all(data).map_err(|e| format!("No se pudo escribir: {e}"))
}

/// Cierra el archivo, lo publica con su nombre (sin sobrescribir) y devuelve su ruta.
#[tauri::command]
pub fn finish_receive(state: State<'_, Transfers>, id: String) -> Result<String, String> {
    let rec = state.receives.lock().unwrap().remove(&id).ok_or("recepción desconocida")?;
    let dir = rec.tmp.parent().map(Path::to_path_buf).ok_or("ruta inválida")?;
    let synced = rec.file.sync_all().map_err(|e| e.to_string());
    drop(rec.file); // Windows no permite enlazar/renombrar un archivo abierto
    match synced.and_then(|()| publish(&rec.tmp, &dir, &rec.name)) {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => {
            let _ = std::fs::remove_file(&rec.tmp);
            Err(e)
        }
    }
}

/// Descarta una recepción incompleta y borra el archivo.
#[tauri::command]
pub fn abort_receive(state: State<'_, Transfers>, id: String) {
    if let Some(rec) = state.receives.lock().unwrap().remove(&id) {
        drop(rec.file);
        let _ = std::fs::remove_file(&rec.tmp);
    }
}

#[cfg(test)]
mod tests {
    use super::{create_temp, migrate_legacy_uploads, publish, sanitize_file_name, TEMP_PREFIX};
    use std::io::Write;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("srvfiles-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_go_to_a_hidden_temp_and_publish_never_overwrites() {
        let dir = temp_dir("publish");
        std::fs::write(dir.join("foto.jpg"), b"vieja").unwrap();

        let (mut file, tmp) = create_temp(&dir).unwrap();
        assert!(tmp.file_name().unwrap().to_string_lossy().starts_with(TEMP_PREFIX));
        file.write_all(b"nueva").unwrap();
        drop(file);

        let path = publish(&tmp, &dir, "foto.jpg").unwrap();
        assert_eq!(path.file_name().unwrap(), "foto (1).jpg");
        assert_eq!(std::fs::read(&path).unwrap(), b"nueva");
        assert_eq!(std::fs::read(dir.join("foto.jpg")).unwrap(), b"vieja");
        assert!(!tmp.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_uploads_are_moved_to_the_shared_folder() {
        let from = temp_dir("legacy-from");
        let to = temp_dir("legacy-to");
        std::fs::write(from.join("a.txt"), b"a").unwrap();
        std::fs::write(to.join("a.txt"), b"ya estaba").unwrap();

        migrate_legacy_uploads(&from, &to);

        assert_eq!(std::fs::read(to.join("a (1).txt")).unwrap(), b"a");
        assert_eq!(std::fs::read(to.join("a.txt")).unwrap(), b"ya estaba");
        assert!(!from.exists());
        let _ = std::fs::remove_dir_all(&to);
    }

    #[test]
    fn sanitize_strips_paths_and_reserved_chars() {
        assert_eq!(sanitize_file_name("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_file_name(r"..\..\boot.ini"), "boot.ini");
        assert_eq!(sanitize_file_name("a:b?.txt"), "a_b_.txt");
        assert_eq!(sanitize_file_name("año señal.txt"), "año señal.txt");
        assert_eq!(sanitize_file_name(".."), "archivo");
    }

    #[test]
    fn hidden_files_are_detected() {
        assert!(super::is_hidden(".DS_Store", None));
        assert!(super::is_hidden(".gitkeep", None));
        assert!(super::is_hidden(".hidden", None));
        assert!(super::is_hidden("desktop.ini", None));
        assert!(super::is_hidden("DESKTOP.INI", None));
        assert!(super::is_hidden("thumbs.db", None));
        assert!(super::is_hidden("Thumbs.db", None));
        assert!(!super::is_hidden("normal.txt", None));
        assert!(!super::is_hidden("foto.jpg", None));
    }
}
