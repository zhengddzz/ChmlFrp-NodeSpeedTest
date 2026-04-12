mod commands;
mod models;
mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    if let Err(e) = window.set_title("") {
                        eprintln!("Failed to set window title: {:?}", e);
                    }
                }

                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = window.set_decorations(false) {
                        eprintln!("Failed to set decorations: {:?}", e);
                    }
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::http_request,
            commands::http_request_raw,
            commands::tcping_host,
            commands::copy_background_image,
            commands::copy_background_video,
            commands::get_background_video_path,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            _ => {
                #[cfg(not(target_os = "macos"))]
                let _ = app_handle;
            }
        });
}
