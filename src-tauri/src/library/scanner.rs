use std::collections::HashSet;
use std::path::{Path, PathBuf};

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::Accessor;
use rayon::prelude::*;
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

/// Commit SQLite work periodically during scan to reduce fsync overhead while keeping
/// per-file isolation via SAVEPOINT (a failed tag read does not abort prior tracks in the batch).
const SCAN_TX_BATCH_SIZE: u32 = 500;

struct ScanBatchTx<'a> {
    conn: &'a Connection,
    txn_open: bool,
    committed_in_batch: u32,
}

impl<'a> ScanBatchTx<'a> {
    fn new(conn: &'a Connection) -> Self {
        Self {
            conn,
            txn_open: false,
            committed_in_batch: 0,
        }
    }

    fn ensure_transaction(&mut self) -> Result<(), String> {
        if !self.txn_open {
            self.conn
                .execute("BEGIN IMMEDIATE", [])
                .map_err(|e| e.to_string())?;
            self.txn_open = true;
        }
        Ok(())
    }

    fn after_file_success(&mut self) -> Result<(), String> {
        self.committed_in_batch += 1;
        if self.committed_in_batch >= SCAN_TX_BATCH_SIZE {
            self.conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            self.txn_open = false;
            self.committed_in_batch = 0;
        }
        Ok(())
    }

    fn finish(self) -> Result<(), String> {
        if self.txn_open {
            self.conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

/// Extracted metadata from a single audio file (no DB access needed).
struct ExtractedTrack {
    insert: InsertTrack,
    artists: Vec<String>,
}

/// Phase 1: Collect all audio file paths recursively.
fn collect_audio_files(dir: &Path) -> Result<Vec<(PathBuf, String)>, String> {
    let mut result = Vec::new();
    collect_recursive(dir, &mut result)?;
    Ok(result)
}

fn collect_recursive(dir: &Path, result: &mut Vec<(PathBuf, String)>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Cannot read dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_recursive(&path, result)?;
            continue;
        }
        if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) {
            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                result.push((path, ext));
            }
        }
    }
    Ok(())
}

/// Phase 2: Extract metadata from a single file (pure I/O, no DB).
fn extract_metadata(path: &Path, ext: &str, settings: &AppSettings) -> Result<ExtractedTrack, String> {
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

    // Parse artist names
    let mut all_artists = Vec::new();
    if let Some(ref a) = artist {
        all_artists.extend(parse_artists(a, settings));
    }
    if let Some(ref aa) = album_artist {
        all_artists.extend(parse_artists(aa, settings));
    }
    let mut seen = HashSet::new();
    let unique_artists: Vec<String> = all_artists
        .into_iter()
        .filter(|n| {
            let key = n.to_lowercase();
            seen.insert(key)
        })
        .collect();

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

    Ok(ExtractedTrack {
        insert,
        artists: unique_artists,
    })
}

/// Phase 3: Insert an extracted track into the database within a savepoint.
fn insert_extracted_in_savepoint(conn: &Connection, extracted: &ExtractedTrack) -> Result<(), String> {
    conn.execute("SAVEPOINT rustune_scan_file", [])
        .map_err(|e| format!("savepoint: {e}"))?;

    match insert_extracted(conn, extracted) {
        Ok(()) => {
            conn.execute("RELEASE SAVEPOINT rustune_scan_file", [])
                .map_err(|e| format!("release savepoint: {e}"))?;
            Ok(())
        }
        Err(e) => {
            conn.execute("ROLLBACK TRANSACTION TO SAVEPOINT rustune_scan_file", [])
                .map_err(|rb| format!("rollback to savepoint: {rb}"))?;
            Err(e)
        }
    }
}

fn insert_extracted(conn: &Connection, extracted: &ExtractedTrack) -> Result<(), String> {
    let track_id = upsert_track(conn, &extracted.insert)?;
    upsert_track_artists(conn, track_id, &extracted.artists)?;
    Ok(())
}

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

    // Phase 1: Collect all audio file paths (single-threaded, fast)
    let all_files = collect_audio_files(path)?;
    let total_files = all_files.len();
    log::info!("Found {} audio files in {}", total_files, root.display());

    // Phase 2: Extract metadata in parallel (no DB access)
    let extracted: Vec<ExtractedTrack> = all_files
        .par_iter()
        .filter_map(|(p, ext)| match extract_metadata(p, ext, settings) {
            Ok(track) => Some(track),
            Err(e) => {
                log::warn!("Failed to read metadata for {}: {}", p.display(), e);
                None
            }
        })
        .collect();

    // Phase 3: Insert into DB sequentially in batched transactions
    let mut count: u32 = 0;
    let mut seen_paths = HashSet::new();
    let mut batch = ScanBatchTx::new(conn);

    for track in &extracted {
        batch.ensure_transaction()?;
        match insert_extracted_in_savepoint(conn, track) {
            Ok(()) => {
                seen_paths.insert(track.insert.path.clone());
                count += 1;
                batch.after_file_success()?;
                if count % 50 == 0 {
                    app.emit("scan-progress", count).ok();
                }
            }
            Err(e) => {
                log::warn!("Failed to insert {}: {}", track.insert.path, e);
            }
        }
    }
    batch.finish()?;

    remove_missing_tracks(conn, &root, &seen_paths)?;

    app.emit("scan-complete", count).ok();
    log::info!(
        "Scan complete: {} tracks found in {}",
        count,
        root.display()
    );
    Ok(count)
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
    let extracted = extract_metadata(path, &ext, settings)?;
    insert_extracted(conn, &extracted)
}
