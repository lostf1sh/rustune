mod audio;
mod commands;
mod db;
mod library;
mod lyrics;
mod tags;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
