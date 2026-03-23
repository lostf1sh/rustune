use tauri::State;

use crate::db::queries::{self, Playlist, Track};
use crate::db::DbConn;

#[tauri::command]
pub fn create_playlist(name: String, db: State<'_, DbConn>) -> Result<Playlist, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::create_playlist(&conn, &name)
}

#[tauri::command]
pub fn get_playlists(db: State<'_, DbConn>) -> Result<Vec<Playlist>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_all_playlists(&conn)
}

#[tauri::command]
pub fn rename_playlist(id: i64, name: String, db: State<'_, DbConn>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::rename_playlist(&conn, id, &name)
}

#[tauri::command]
pub fn delete_playlist(id: i64, db: State<'_, DbConn>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::delete_playlist(&conn, id)
}

#[tauri::command]
pub fn add_tracks_to_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    db: State<'_, DbConn>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::add_tracks_to_playlist(&conn, playlist_id, &track_ids)
}

#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    db: State<'_, DbConn>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::remove_track_from_playlist(&conn, playlist_id, track_id)
}

#[tauri::command]
pub fn get_playlist_tracks(playlist_id: i64, db: State<'_, DbConn>) -> Result<Vec<Track>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::get_playlist_tracks(&conn, playlist_id)
}

#[tauri::command]
pub fn update_playlist_meta(
    id: i64,
    name: String,
    description: String,
    pinned: bool,
    cover_track_path: Option<String>,
    db: State<'_, DbConn>,
) -> Result<Playlist, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::update_playlist_meta(&conn, id, &name, &description, pinned, cover_track_path.as_deref())
}

#[tauri::command]
pub fn toggle_playlist_pin(id: i64, db: State<'_, DbConn>) -> Result<Playlist, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::toggle_playlist_pin(&conn, id)
}

#[tauri::command]
pub fn remove_tracks_from_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    db: State<'_, DbConn>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::remove_tracks_from_playlist(&conn, playlist_id, &track_ids)
}

#[tauri::command]
pub fn reorder_playlist_tracks(
    playlist_id: i64,
    track_ids: Vec<i64>,
    db: State<'_, DbConn>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::reorder_playlist_tracks(&conn, playlist_id, track_ids)
}
