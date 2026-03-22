mod audio;
mod commands;
mod db;
mod library;

use audio::engine::AudioEngine;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize audio engine
            let engine = AudioEngine::new(app.handle().clone());
            app.manage(engine);

            // Initialize database
            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let conn = db::init_db(&app_data_dir).map_err(|e| e.to_string())?;
            app.manage(Mutex::new(conn) as db::DbConn);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::playback::play_file,
            commands::playback::pause,
            commands::playback::resume,
            commands::playback::stop,
            commands::playback::seek,
            commands::playback::set_volume,
            commands::playback::get_playback_state,
            commands::library::scan_folder,
            commands::library::get_tracks,
            commands::library::search_tracks,
            commands::library::get_track_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
