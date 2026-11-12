//! SrvFiles desktop shell.
//!
//! - Arranca el backend Go como sidecar, elige un puerto libre y lo reinicia
//!   si se cae (hasta 3 veces). Si no puede arrancar muestra un diálogo con la
//!   causa en lugar de cerrarse en silencio.
//! - Una sola instancia: abrir la app de nuevo enfoca la ventana existente.
//! - Comandos nativos para subir, descargar y recibir archivos en streaming.
//!   El webview no tiene permisos de sistema de archivos: todo lo que se
//!   escribe va a `Descargas/SrvFiles` con el nombre saneado.

mod files;

use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PORT: u16 = 3001;
const MAX_RESTARTS: u32 = 3;

/// Estado del backend sidecar.
pub struct Backend {
    port: u16,
    child: Mutex<Option<CommandChild>>,
    shutting_down: AtomicBool,
    restarts: AtomicU32,
}

/// Puerto HTTP en el que escucha el backend local (HTTPS = puerto + 1).
#[tauri::command]
fn backend_port(state: tauri::State<'_, Backend>) -> u16 {
    state.port
}

/// Elige el puerto: 3001 si está libre (es el que buscan los otros
/// dispositivos al escanear la red); si no, el primer par libre a partir de 3011.
fn choose_port() -> u16 {
    let free = |p: u16| TcpListener::bind(("0.0.0.0", p)).is_ok() && TcpListener::bind(("0.0.0.0", p + 1)).is_ok();
    if free(DEFAULT_PORT) {
        return DEFAULT_PORT;
    }
    (3011..3099).step_by(2).find(|p| free(*p)).unwrap_or(DEFAULT_PORT)
}

fn show_error(app: &AppHandle, message: impl Into<String>) {
    let message = message.into();
    log::error!("{message}");
    app.dialog()
        .message(message)
        .kind(MessageDialogKind::Error)
        .title("SrvFiles")
        .show(|_| {});
}

/// Lanza el sidecar y vigila su salida.
fn spawn_backend(app: &AppHandle) -> Result<(), String> {
    let backend = app.state::<Backend>();
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    let uploads_dir = data_dir.join("uploads");
    let certs_dir = data_dir.join("certs");
    let backend_logs = log_dir.join("backend");
    for dir in [&uploads_dir, &certs_dir, &backend_logs] {
        std::fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    }

    let port = backend.port;
    log::info!("Spawning sidecar on port {port}, uploads dir: {uploads_dir:?}");

    let (mut rx, child) = app
        .shell()
        .sidecar("srvfiles-sidecar")
        .map_err(|e| format!("No se encontró el servidor interno (srvfiles-sidecar): {e}"))?
        .env("PORT", port.to_string())
        .env("HTTPS_PORT", (port + 1).to_string())
        .env("APP_ENV", "production")
        .env("UPLOADS_DIR", uploads_dir.to_string_lossy().to_string())
        .env("CERTS_DIR", certs_dir.to_string_lossy().to_string())
        .env("LOGS_DIR", backend_logs.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| format!("No se pudo iniciar el servidor interno: {e}"))?;

    *backend.child.lock().unwrap() = Some(child);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut last_error: Option<String> = None;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) | CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line).trim().to_string();
                    if let Some(rest) = text.strip_prefix("SRVFILES_ERROR ") {
                        last_error = Some(rest.to_string());
                    }
                }
                CommandEvent::Terminated(payload) => {
                    on_backend_exit(&app, payload.code, last_error.take());
                    break;
                }
                CommandEvent::Error(err) => log::error!("sidecar error: {err}"),
                _ => {}
            }
        }
    });
    Ok(())
}

fn on_backend_exit(app: &AppHandle, code: Option<i32>, error: Option<String>) {
    let backend = app.state::<Backend>();
    backend.child.lock().unwrap().take();
    if backend.shutting_down.load(Ordering::SeqCst) {
        return;
    }
    log::error!("Backend exited (code {code:?}, error {error:?})");

    if let Some(err) = error.as_deref() {
        if err.starts_with("port_in_use") {
            show_error(
                app,
                format!(
                    "El puerto {} está ocupado por otro programa. Cerralo (o cerrá otra copia de SrvFiles) y volvé a abrir la app.",
                    backend.port
                ),
            );
            return;
        }
    }

    let attempt = backend.restarts.fetch_add(1, Ordering::SeqCst) + 1;
    if attempt > MAX_RESTARTS {
        show_error(
            app,
            "El servidor interno se detuvo varias veces seguidas. Revisá los registros (menú Ayuda del sistema) o reiniciá la app.",
        );
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        match spawn_backend(&app) {
            Ok(()) => {
                let _ = app.emit("backend-restarted", ());
            }
            Err(e) => show_error(&app, e),
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_log::{Target, TargetKind};

    let app = tauri::Builder::default()
        // Debe registrarse primero.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("errors".into()) }),
                ])
                .max_file_size(2_000_000)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        // Actualizaciones desde GitHub Releases, verificadas con la clave
        // pública de tauri.conf.json (plugins.updater.pubkey).
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Backend {
            port: choose_port(),
            child: Mutex::new(None),
            shutting_down: AtomicBool::new(false),
            restarts: AtomicU32::new(0),
        })
        .manage(files::Transfers::default())
        .invoke_handler(tauri::generate_handler![
            backend_port,
            files::path_info,
            files::upload_files,
            files::download_file,
            files::cancel_transfer,
            files::begin_receive,
            files::append_receive,
            files::finish_receive,
            files::abort_receive,
        ])
        .setup(|app| {
            log::info!("SrvFiles Tauri app starting up");
            if let Err(e) = spawn_backend(app.handle()) {
                show_error(app.handle(), e);
            }
            Ok(())
        })
        .build(tauri::generate_context!());

    let app = match app {
        Ok(app) => app,
        Err(e) => {
            eprintln!("error while building tauri application: {e}");
            std::process::exit(1);
        }
    };

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            let backend = handle.state::<Backend>();
            backend.shutting_down.store(true, Ordering::SeqCst);
            let child = backend.child.lock().unwrap().take();
            if let Some(child) = child {
                let _ = child.kill();
            }
        }
    });
}
