use crate::tags::editor::{self, AlbumArt};

#[tauri::command]
pub fn get_album_art(path: String) -> Result<Option<AlbumArt>, String> {
    editor::get_album_art(&path)
}
