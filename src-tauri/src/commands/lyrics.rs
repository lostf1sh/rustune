use tauri::State;

use crate::db::queries;
use crate::db::DbConn;
use crate::lyrics::lrclib::{self, LyricsResult};
use crate::settings::SettingsState;

#[tauri::command]
pub async fn fetch_lyrics(
    track_path: String,
    title: String,
    artist: String,
    album: String,
    duration_secs: f64,
    db: State<'_, DbConn>,
    settings: State<'_, SettingsState>,
) -> Result<LyricsResult, String> {
    // 1. Check for local .lrc file (if preferLocalLrc enabled)
    let prefer_local = settings.lock().map(|s| s.0.prefer_local_lrc).unwrap_or(true);
    if prefer_local {
        let lrc_path = std::path::Path::new(&track_path).with_extension("lrc");
        if lrc_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&lrc_path) {
                let synced = lrclib::parse_lrc(&content);
                return Ok(LyricsResult {
                    synced: if synced.is_empty() { None } else { Some(synced) },
                    plain: Some(content),
                });
            }
        }
    }

    // 2. Check DB cache
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        if let Some(cached) = queries::get_cached_lyrics(&conn, &track_path)? {
            let synced = cached.synced_lyrics.as_deref().map(lrclib::parse_lrc);
            return Ok(LyricsResult {
                synced,
                plain: cached.plain_lyrics,
            });
        }
    }

    // 3. Fetch from remote
    let raw = lrclib::fetch_lyrics_raw(&title, &artist, &album, duration_secs).await?;

    // 4. Cache result
    {
        let conn = db.lock().map_err(|e| e.to_string())?;
        queries::cache_lyrics(
            &conn,
            &track_path,
            raw.synced_lyrics_raw.as_deref(),
            raw.plain_lyrics.as_deref(),
        )?;
    }

    // 5. Parse and return
    let synced = raw.synced_lyrics_raw.as_deref().map(lrclib::parse_lrc);
    Ok(LyricsResult {
        synced,
        plain: raw.plain_lyrics,
    })
}
