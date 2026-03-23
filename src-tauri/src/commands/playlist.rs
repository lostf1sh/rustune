use tauri::State;

use crate::db::queries::{self, Playlist, Track};
use crate::db::DbPool;

#[tauri::command]
pub fn create_playlist(name: String, db: State<'_, DbPool>) -> Result<Playlist, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::create_playlist(&conn, &name)
}

#[tauri::command]
pub fn get_playlists(db: State<'_, DbPool>) -> Result<Vec<Playlist>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_all_playlists(&conn)
}

#[tauri::command]
pub fn rename_playlist(id: i64, name: String, db: State<'_, DbPool>) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::rename_playlist(&conn, id, &name)
}

#[tauri::command]
pub fn delete_playlist(id: i64, db: State<'_, DbPool>) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::delete_playlist(&conn, id)
}

#[tauri::command]
pub fn add_tracks_to_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::add_tracks_to_playlist(&conn, playlist_id, &track_ids)
}

#[tauri::command]
pub fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    db: State<'_, DbPool>,
) -> Result<(), String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::remove_track_from_playlist(&conn, playlist_id, track_id)
}

#[tauri::command]
pub fn get_playlist_tracks(playlist_id: i64, db: State<'_, DbPool>) -> Result<Vec<Track>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    queries::get_playlist_tracks(&conn, playlist_id)
}
