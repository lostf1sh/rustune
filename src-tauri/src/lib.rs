mod audio;
mod commands;
mod db;
mod library;
mod lyrics;
mod settings;
mod tags;

use audio::engine::AudioEngine;
use std::sync::{Arc, Mutex};
use tauri::Manager;

use settings::SettingsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Debug
            } else {
                log::LevelFilter::Info
            };
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;

            // Initialize audio engine
            let engine = AudioEngine::new(app.handle().clone());
            app.manage(engine);

            let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

            // Load settings
            let (app_settings, config_path) = settings::load_settings(&app_data_dir);
            let auto_watch = app_settings.auto_watch;
            let scan_on_startup = app_settings.scan_on_startup;
            let settings_state: SettingsState =
                Arc::new(Mutex::new((app_settings.clone(), config_path)));
            app.manage(settings_state.clone());

            // Initialize database (connection pool)
            let pool = db::init_db(&app_data_dir, &app_settings).map_err(|e| e.to_string())?;
            app.manage(pool.clone());

            // Start library file watcher (only if autoWatch enabled)
            let watcher = library::watcher::LibraryWatcher::new(
                pool.clone(),
                app.handle().clone(),
                settings_state,
            );
            if auto_watch {
                if let Err(e) = watcher.watch_all_roots() {
                    log::warn!("Failed to start library watchers: {}", e);
                }
            }
            app.manage(watcher);

            // Scan on startup if enabled
            if scan_on_startup {
                let db_pool = pool.clone();
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    let conn = db_pool.get().unwrap();
                    let roots = db::queries::get_library_roots(&conn).unwrap_or_default();
                    drop(conn);
                    for root in roots {
                        let conn = db_pool.get().unwrap();
                        library::scanner::scan_folder(
                            &conn,
                            &root.path,
                            &app_handle,
                            &app_settings,
                        )
                        .ok();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::playback::play_file,
            commands::playback::play_queue,
            commands::playback::pause,
            commands::playback::resume,
            commands::playback::stop,
            commands::playback::seek,
            commands::playback::set_volume,
            commands::playback::next_track,
            commands::playback::prev_track,
            commands::playback::toggle_shuffle,
            commands::playback::cycle_repeat,
            commands::playback::add_to_queue,
            commands::playback::remove_from_queue,
            commands::playback::insert_next_in_queue,
            commands::playback::clear_queue,
            commands::playback::get_playback_state,
            commands::library::scan_folder,
            commands::library::get_tracks,
            commands::library::get_tracks_page,
            commands::library::search_tracks,
            commands::library::get_track_count,
            commands::library::get_library_roots,
            commands::library::remove_library_root,
            commands::library::get_artists,
            commands::library::get_artist_tracks,
            commands::library::get_albums,
            commands::library::get_album_tracks,
            commands::library::toggle_favorite,
            commands::library::get_favorites,
            commands::library::record_play,
            commands::library::get_recent_plays,
            commands::playlist::create_playlist,
            commands::playlist::get_playlists,
            commands::playlist::rename_playlist,
            commands::playlist::delete_playlist,
            commands::playlist::add_tracks_to_playlist,
            commands::playlist::remove_track_from_playlist,
            commands::playlist::get_playlist_tracks,
            commands::tags::get_album_art,
            commands::tags::read_tags,
            commands::tags::write_tags,
            commands::lyrics::fetch_lyrics,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            commands::settings::rebuild_artist_index,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            let msg = format!("Failed to start Rustune:\n{}", e);
            eprintln!("{}", msg);
            show_fatal_error(&msg);
        });
}

fn show_fatal_error(message: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use std::ptr;

        extern "system" {
            fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, utype: u32) -> i32;
        }

        let text: Vec<u16> = OsStr::new(message).encode_wide().chain(Some(0)).collect();
        let caption: Vec<u16> = OsStr::new("Rustune").encode_wide().chain(Some(0)).collect();

        unsafe {
            MessageBoxW(ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = message;
    }
}
