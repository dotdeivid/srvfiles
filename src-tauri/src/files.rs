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

#[derive(Default)]
pub struct Transfers {
    cancel: Mutex<HashMap<String, Arc<AtomicBool>>>,
    receives: Mutex<HashMap<String, Receive>>,
}

struct Receive {
    file: File,
    path: PathBuf,
}

#[derive(Clone, Serialize)]
struct Progress<'a> {
    id: &'a str,
    loaded: u64,
    total: u64,
}

// ─── Names & paths ───────────────────────────────────────────────────────────

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

fn downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?.join(SUBFOLDER);
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Crea (sin sobrescribir) un archivo nuevo en `dir`, agregando " (n)" si hace falta.
fn create_unique(dir: &Path, name: &str) -> Result<(File, PathBuf), String> {
    let safe = sanitize_file_name(name);
    let (stem, ext) = match safe.rfind('.') {
        Some(i) if i > 0 => (&safe[..i], &safe[i..]),
        _ => (safe.as_str(), ""),
    };
    for n in 0..10_000 {
        let candidate = if n == 0 { safe.clone() } else { format!("{stem} ({n}){ext}") };
        let path = dir.join(&candidate);
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((file, path)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("No se pudo crear el archivo: {e}")),
        }
    }
    Err("No hay un nombre libre para el archivo".into())
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
    let (file, path) = create_unique(&dir, file_name)?;
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
    match outcome {
        Ok(()) => Ok(path.to_string_lossy().to_string()),
        Err(e) => {
            let _ = std::fs::remove_file(&path);
            Err(e)
        }
    }
}

// ─── P2P receive ─────────────────────────────────────────────────────────────

/// Crea el archivo de destino para una recepción P2P. Devuelve la ruta.
#[tauri::command]
pub fn begin_receive(app: AppHandle, state: State<'_, Transfers>, id: String, file_name: String) -> Result<String, String> {
    let dir = downloads_dir(&app)?;
    let (file, path) = create_unique(&dir, &file_name)?;
    let shown = path.to_string_lossy().to_string();
    state.receives.lock().unwrap().insert(id, Receive { file, path });
    Ok(shown)
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

/// Cierra el archivo y devuelve su ruta.
#[tauri::command]
pub fn finish_receive(state: State<'_, Transfers>, id: String) -> Result<String, String> {
    let rec = state.receives.lock().unwrap().remove(&id).ok_or("recepción desconocida")?;
    rec.file.sync_all().map_err(|e| e.to_string())?;
    Ok(rec.path.to_string_lossy().to_string())
}

/// Descarta una recepción incompleta y borra el archivo.
#[tauri::command]
pub fn abort_receive(state: State<'_, Transfers>, id: String) {
    if let Some(rec) = state.receives.lock().unwrap().remove(&id) {
        drop(rec.file);
        let _ = std::fs::remove_file(&rec.path);
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_file_name;

    #[test]
    fn sanitize_strips_paths_and_reserved_chars() {
        assert_eq!(sanitize_file_name("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_file_name(r"..\..\boot.ini"), "boot.ini");
        assert_eq!(sanitize_file_name("a:b?.txt"), "a_b_.txt");
        assert_eq!(sanitize_file_name("año señal.txt"), "año señal.txt");
        assert_eq!(sanitize_file_name(".."), "archivo");
    }
}
