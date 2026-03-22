use crate::lyrics::lrclib::{self, LyricsResult};

#[tauri::command]
pub async fn fetch_lyrics(
    title: String,
    artist: String,
    album: String,
    duration_secs: f64,
) -> Result<LyricsResult, String> {
    lrclib::fetch_lyrics(&title, &artist, &album, duration_secs).await
}
