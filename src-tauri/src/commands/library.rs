use tauri::{AppHandle, State};

use crate::db::queries::{self, AlbumInfo, ArtistInfo, LibraryRoot, Track};
use crate::db::DbPool;
use crate::library::scanner;
use crate::library::watcher::LibraryWatcher;
use crate::settings::SettingsState;

#[tauri::command]
pub fn scan_folder(
    folder: String,
    db: State<'_, DbPool>,
    app: AppHandle,
    watcher: State<'_, LibraryWatcher>,
    settings: State<'_, SettingsState>,
) -> Result<u32, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let current_settings = settings.lock().map_err(|e| e.to_string())?.0.clone();
    let count = scanner::scan_folder(&conn, &folder, &app, &current_settings)?;
    drop(conn);
    let auto_watch = current_settings.auto_watch;
    if auto_watch {
        let root = scanner::normalize_root_path(&folder)?;
        watcher.watch_root(&root.to_string_lossy()).ok();
    }
    Ok(count)
}

#[tauri::command]
pub fn get_tracks(db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_all_tracks(&conn)
}

#[tauri::command]
pub fn get_tracks_page(
    offset: i64,
    limit: i64,
    db: State<'_, DbPool>,
) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let limit = limit.clamp(1, 10_000);
    let offset = offset.max(0);
    queries::get_tracks_page(&conn, offset, limit)
}

#[tauri::command]
pub fn search_tracks(query: String, db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::search_tracks(&conn, &query)
}

#[tauri::command]
pub fn get_track_count(db: State<'_, DbPool>) -> Result<i64, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_track_count(&conn)
}

#[tauri::command]
pub fn get_library_roots(db: State<'_, DbPool>) -> Result<Vec<LibraryRoot>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_library_roots(&conn)
}

#[tauri::command]
pub fn remove_library_root(
    path: String,
    db: State<'_, DbPool>,
    watcher: State<'_, LibraryWatcher>,
) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let tracked_paths = queries::get_track_paths_in_root(&conn, &path)?;

    queries::delete_library_root(&conn, &path)?;
    queries::delete_tracks_by_paths(&conn, &tracked_paths)?;
    drop(conn);

    watcher.unwatch_root(&path);
    Ok(())
}

#[tauri::command]
pub fn get_artists(db: State<'_, DbPool>) -> Result<Vec<ArtistInfo>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_artists(&conn)
}

#[tauri::command]
pub fn get_artist_tracks(artist: String, db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_artist_tracks(&conn, &artist)
}

#[tauri::command]
pub fn get_albums(db: State<'_, DbPool>) -> Result<Vec<AlbumInfo>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_albums(&conn)
}

#[tauri::command]
pub fn get_album_tracks(
    album: String,
    album_artist: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_album_tracks(&conn, &album, album_artist.as_deref())
}

#[tauri::command]
pub fn toggle_favorite(track_id: i64, db: State<'_, DbPool>) -> Result<bool, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::toggle_favorite(&conn, track_id)
}

#[tauri::command]
pub fn get_favorites(db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_favorites(&conn)
}

#[tauri::command]
pub fn record_play(track_id: i64, db: State<'_, DbPool>) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::record_play(&conn, track_id)
}

#[tauri::command]
pub fn get_recent_plays(limit: Option<i64>, db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_recent_plays(&conn, limit.unwrap_or(50))
}
