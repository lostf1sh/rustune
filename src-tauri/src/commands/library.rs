use tauri::{AppHandle, State};

use crate::db::queries::{self, Track};
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
