use std::collections::HashSet;
use std::path::{Path, PathBuf};

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use crate::db::queries::{
    delete_tracks_by_paths, get_track_paths_in_root, upsert_library_root, upsert_track,
    upsert_track_artists, InsertTrack,
};
use crate::library::artists::parse_artists;
use crate::settings::AppSettings;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma", "ape", "wv", "aiff", "alac",
];

pub fn scan_folder(
    conn: &Connection,
    folder: &str,
    app: &AppHandle,
    settings: &AppSettings,
) -> Result<u32, String> {
    let root = normalize_root_path(folder)?;
    let path = root.as_path();
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    upsert_library_root(conn, &root.to_string_lossy())?;

    let mut count: u32 = 0;
    let mut seen_paths = HashSet::new();
    scan_recursive(conn, path, app, &mut count, &mut seen_paths, settings)?;
    remove_missing_tracks(conn, &root, &seen_paths)?;

    app.emit("scan-complete", count).ok();
    log::info!(
        "Scan complete: {} tracks found in {}",
        count,
        root.display()
    );
    Ok(count)
}

fn scan_recursive(
    conn: &Connection,
    dir: &Path,
    app: &AppHandle,
    count: &mut u32,
    seen_paths: &mut HashSet<String>,
    settings: &AppSettings,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Cannot read dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            scan_recursive(conn, &path, app, count, seen_paths, settings)?;
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        if let Some(ext) = ext {
            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                match extract_and_insert(conn, &path, &ext, settings) {
                    Ok(_) => {
                        seen_paths.insert(path.to_string_lossy().to_string());
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

fn remove_missing_tracks(
    conn: &Connection,
    root: &Path,
    seen_paths: &HashSet<String>,
) -> Result<(), String> {
    let root_str = root.to_string_lossy();
    let existing_paths = get_track_paths_in_root(conn, &root_str)?;
    let stale_paths: Vec<String> = existing_paths
        .into_iter()
        .filter(|path| !seen_paths.contains(path))
        .collect();

    if stale_paths.is_empty() {
        return Ok(());
    }

    delete_tracks_by_paths(conn, &stale_paths)?;
    log::info!(
        "Removed {} stale tracks under {}",
        stale_paths.len(),
        root.display()
    );
    Ok(())
}

pub fn normalize_root_path(folder: &str) -> Result<PathBuf, String> {
    let path = Path::new(folder);
    path.canonicalize()
        .map_err(|e| format!("Failed to resolve path {}: {}", folder, e))
}

fn extract_and_insert(
    conn: &Connection,
    path: &Path,
    ext: &str,
    settings: &AppSettings,
) -> Result<(), String> {
    let path_str = path.to_string_lossy().to_string();
    let file_size = std::fs::metadata(path).map(|m| m.len() as i64).ok();

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

    let has_art = tag.map(|t| !t.pictures().is_empty()).unwrap_or(false);

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

    let track_id = upsert_track(conn, &insert)?;

    // Parse and store individual artist names
    let mut all_artists = Vec::new();
    if let Some(ref a) = insert.artist {
        all_artists.extend(parse_artists(a, settings));
    }
    if let Some(ref aa) = insert.album_artist {
        all_artists.extend(parse_artists(aa, settings));
    }
    // Deduplicate
    let mut seen = std::collections::HashSet::new();
    let unique_artists: Vec<String> = all_artists
        .into_iter()
        .filter(|n| {
            let key = n.to_lowercase();
            seen.insert(key)
        })
        .collect();
    upsert_track_artists(conn, track_id, &unique_artists)?;

    Ok(())
}

pub fn rescan_file(
    conn: &Connection,
    path_str: &str,
    settings: &AppSettings,
) -> Result<(), String> {
    let path = Path::new(path_str);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    extract_and_insert(conn, path, &ext, settings)
}
