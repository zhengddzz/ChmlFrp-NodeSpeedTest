mod commands;
mod models;
mod utils;

use models::FrpcProcesses;
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(FrpcProcesses::new())
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
            commands::ping_host,
            commands::start_tcp_speed_server,
            commands::stop_tcp_speed_server,
            commands::check_tcp_speed_server,
            commands::tcp_speed_test,
            commands::copy_background_image,
            commands::copy_background_video,
            commands::get_background_video_path,
            commands::start_file_server,
            commands::stop_file_server,
            commands::get_file_server_port,
            commands::is_file_server_running,
            commands::start_frpc,
            commands::stop_frpc,
            commands::stop_all_frpc,
            commands::is_frpc_running,
            commands::check_frpc_exists,
            commands::get_frpc_download_url,
            commands::download_frpc,
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
