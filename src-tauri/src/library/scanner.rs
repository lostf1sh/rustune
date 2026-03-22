use std::path::Path;

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use crate::db::queries::{upsert_track, InsertTrack};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma", "ape", "wv", "aiff", "alac",
];

pub fn scan_folder(conn: &Connection, folder: &str, app: &AppHandle) -> Result<u32, String> {
    let path = Path::new(folder);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", folder));
    }

    let mut count: u32 = 0;
    scan_recursive(conn, path, app, &mut count)?;

    app.emit("scan-complete", count).ok();
    log::info!("Scan complete: {} tracks found in {}", count, folder);
    Ok(count)
}

fn scan_recursive(
    conn: &Connection,
    dir: &Path,
    app: &AppHandle,
    count: &mut u32,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Cannot read dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            scan_recursive(conn, &path, app, count)?;
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if let Some(ext) = ext {
            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                match extract_and_insert(conn, &path, &ext) {
                    Ok(_) => {
                        *count += 1;
                        if *count % 50 == 0 {
                            app.emit("scan-progress", *count).ok();
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to process {}: {}", path.display(), e);
                    }
                }
            }
        }
    }

    Ok(())
}

fn extract_and_insert(conn: &Connection, path: &Path, ext: &str) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();
    let file_size = std::fs::metadata(path)
        .map(|m| m.len() as i64)
        .ok();

    let tagged = lofty::read_from_path(path).map_err(|e| e.to_string())?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    let properties = tagged.properties();

    let (title, artist, album, album_artist, genre, track_number, disc_number, year) =
        if let Some(tag) = tag {
            (
                tag.title().map(|s| s.to_string()),
                tag.artist().map(|s| s.to_string()),
                tag.album().map(|s| s.to_string()),
                tag.get_string(&lofty::tag::ItemKey::AlbumArtist)
                    .map(|s| s.to_string()),
                tag.genre().map(|s| s.to_string()),
                tag.track().map(|t| t as i32),
                tag.disk().map(|d| d as i32),
                tag.year().map(|y| y as i32),
            )
        } else {
            (None, None, None, None, None, None, None, None)
        };

    let title = title.or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    });

    let duration_ms = if properties.duration().as_millis() > 0 {
        Some(properties.duration().as_millis() as i64)
    } else {
        None
    };

    let sample_rate = properties.sample_rate().map(|r| r as i32);
    let bit_depth = properties.bit_depth().map(|b| b as i32);

    let has_art = tag
        .map(|t| !t.pictures().is_empty())
        .unwrap_or(false);

    let insert = InsertTrack {
        path: path_str,
        title,
        artist,
        album,
        album_artist,
        genre,
        track_number,
        disc_number,
        year,
        duration_ms,
        file_size,
        format: Some(ext.to_uppercase()),
        sample_rate,
        bit_depth,
        has_art,
    };

    upsert_track(conn, &insert)?;
    Ok(())
}
