#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
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

                let uploads_dir = app_data_dir.join("uploads");
                std::fs::create_dir_all(&uploads_dir).ok();

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
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
