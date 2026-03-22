use tauri::{AppHandle, State};

use crate::db::queries::{self, AlbumInfo, ArtistInfo, LibraryRoot, Track};
use crate::db::DbConn;
use crate::library::scanner;

#[tauri::command]
pub fn scan_folder(folder: String, db: State<'_, DbConn>, app: AppHandle) -> Result<u32, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    scanner::scan_folder(&conn, &folder, &app)
}

#[tauri::command]
pub fn get_tracks(db: State<'_, DbConn>) -> Result<Vec<Track>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_all_tracks(&conn)
}

#[tauri::command]
pub fn search_tracks(query: String, db: State<'_, DbConn>) -> Result<Vec<Track>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::search_tracks(&conn, &query)
}

#[tauri::command]
pub fn get_track_count(db: State<'_, DbConn>) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_track_count(&conn)
}

#[tauri::command]
pub fn get_library_roots(db: State<'_, DbConn>) -> Result<Vec<LibraryRoot>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_library_roots(&conn)
}

#[tauri::command]
pub fn remove_library_root(path: String, db: State<'_, DbConn>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let tracked_paths = queries::get_track_paths_in_root(&conn, &path)?;

    queries::delete_library_root(&conn, &path)?;
    queries::delete_tracks_by_paths(&conn, &tracked_paths)?;

    Ok(())
}

#[tauri::command]
pub fn get_artists(db: State<'_, DbConn>) -> Result<Vec<ArtistInfo>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_artists(&conn)
}

#[tauri::command]
pub fn get_artist_tracks(artist: String, db: State<'_, DbConn>) -> Result<Vec<Track>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_artist_tracks(&conn, &artist)
}

#[tauri::command]
pub fn get_albums(db: State<'_, DbConn>) -> Result<Vec<AlbumInfo>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_albums(&conn)
}

#[tauri::command]
pub fn get_album_tracks(
    album: String,
    album_artist: Option<String>,
    db: State<'_, DbConn>,
) -> Result<Vec<Track>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_album_tracks(&conn, &album, album_artist.as_deref())
}
