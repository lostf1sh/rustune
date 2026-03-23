use tauri::State;

use crate::db::DbConn;
use crate::library::scanner;
use crate::settings::SettingsState;
use crate::tags::editor::{self, AlbumArt, TagInfo, TagUpdate};

#[tauri::command]
pub fn get_album_art(path: String) -> Result<Option<AlbumArt>, String> {
    editor::get_album_art(&path)
}

#[tauri::command]
pub fn read_tags(path: String) -> Result<TagInfo, String> {
    editor::read_tags(&path)
}

#[tauri::command]
pub fn write_tags(
    path: String,
    tags: TagUpdate,
    db: State<'_, DbConn>,
    settings: State<'_, SettingsState>,
) -> Result<(), String> {
    editor::write_tags(&path, &tags)?;

    // Re-scan this file to update DB with new metadata
    let conn = db.lock().map_err(|e| e.to_string())?;
    let current_settings = settings.lock().map_err(|e| e.to_string())?.0.clone();
    scanner::rescan_file(&conn, &path, &current_settings)?;

    editor::invalidate_album_art_cache(&path);

    Ok(())
}
