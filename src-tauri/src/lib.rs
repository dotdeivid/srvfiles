#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Initializes and runs the Tauri application.
///
/// Registers the required plugins (shell, dialog, fs, log) and sets up the application
/// via a `setup` closure. In release builds the closure spawns the bundled backend
/// sidecar (`srvfiles-sidecar`) with `UPLOADS_DIR` pointing to the platform-specific
/// app data directory. In debug builds (`tauri dev`) the backend is expected to be
/// running separately via `npm run dev`, so the sidecar is not launched.
///
/// # Panics
/// Panics if:
/// - The app data directory cannot be resolved.
/// - The sidecar binary is missing (run `npm run build:sidecar` first).
/// - The sidecar fails to spawn.
/// - The Tauri event loop encounters an unrecoverable error.
pub fn run() {
    use tauri_plugin_log::{Target, TargetKind};

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("errors".into()) }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            log::info!("SrvFiles Tauri app starting up");

            // In release builds, launch the bundled backend sidecar.
            // In dev mode (`tauri dev`), the backend runs separately via `npm run dev`.
            #[cfg(not(debug_assertions))]
            {
                use tauri::Manager;
                use tauri_plugin_shell::ShellExt;

                let app_data_dir = _app
                    .path()
                    .app_data_dir()
                    .expect("failed to resolve app data dir");

                log::info!("App data dir: {:?}", app_data_dir);

                let uploads_dir = app_data_dir.join("uploads");
                std::fs::create_dir_all(&uploads_dir).ok();

                log::info!("Spawning sidecar, uploads dir: {:?}", uploads_dir);

                _app.shell()
                    .sidecar("srvfiles-sidecar")
                    .expect("sidecar 'srvfiles-sidecar' not found — run npm run build:sidecar first")
                    .env("TAURI_ENV", "1")
                    .env(
                        "UPLOADS_DIR",
                        uploads_dir.to_str().expect("uploads path is not valid UTF-8"),
                    )
                    .spawn()
                    .expect("failed to spawn sidecar");

                log::info!("Sidecar spawned successfully");
            }

            #[cfg(debug_assertions)]
            {
                log::info!("Dev mode: backend expected to be running separately via `npm run dev`");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
