use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i64,
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub year: Option<i32>,
    pub duration_ms: Option<i64>,
    pub file_size: Option<i64>,
    pub format: Option<String>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub has_art: bool,
    pub favorite: bool,
}

#[derive(Debug)]
pub struct InsertTrack {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub year: Option<i32>,
    pub duration_ms: Option<i64>,
    pub file_size: Option<i64>,
    pub format: Option<String>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub has_art: bool,
}

pub fn upsert_track(conn: &Connection, track: &InsertTrack) -> Result<i64, String> {
    conn.query_row(
        "INSERT INTO tracks (path, title, artist, album, album_artist, genre, track_number, disc_number, year, duration_ms, file_size, format, sample_rate, bit_depth, has_art, modified_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))
         ON CONFLICT(path) DO UPDATE SET
            title=excluded.title, artist=excluded.artist, album=excluded.album,
            album_artist=excluded.album_artist, genre=excluded.genre,
            track_number=excluded.track_number, disc_number=excluded.disc_number,
            year=excluded.year, duration_ms=excluded.duration_ms,
            file_size=excluded.file_size, format=excluded.format,
            sample_rate=excluded.sample_rate, bit_depth=excluded.bit_depth,
            has_art=excluded.has_art, modified_at=datetime('now')
         RETURNING id",
        params![
            track.path,
            track.title,
            track.artist,
            track.album,
            track.album_artist,
            track.genre,
            track.track_number,
            track.disc_number,
            track.year,
            track.duration_ms,
            track.file_size,
            track.format,
            track.sample_rate,
            track.bit_depth,
            track.has_art,
        ],
        |row| row.get(0),
    )
    .map_err(|e| format!("Failed to upsert track: {}", e))
}

fn row_to_track(row: &rusqlite::Row) -> rusqlite::Result<Track> {
    Ok(Track {
        id: row.get(0)?,
        path: row.get(1)?,
        title: row.get(2)?,
        artist: row.get(3)?,
        album: row.get(4)?,
        album_artist: row.get(5)?,
        genre: row.get(6)?,
        track_number: row.get(7)?,
        disc_number: row.get(8)?,
        year: row.get(9)?,
        duration_ms: row.get(10)?,
        file_size: row.get(11)?,
        format: row.get(12)?,
        sample_rate: row.get(13)?,
        bit_depth: row.get(14)?,
        has_art: row.get::<_, i32>(15).map(|v| v != 0)?,
        favorite: row.get::<_, i32>(16).map(|v| v != 0).unwrap_or(false),
    })
}

pub fn get_all_tracks(conn: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art, COALESCE(favorite, 0) as favorite
             FROM tracks ORDER BY album_artist, album, disc_number, track_number, title",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map([], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

pub fn get_tracks_page(conn: &Connection, offset: i64, limit: i64) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art, COALESCE(favorite, 0) as favorite
             FROM tracks ORDER BY album_artist, album, disc_number, track_number, title
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map(params![limit, offset], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

pub fn search_tracks(conn: &Connection, query: &str) -> Result<Vec<Track>, String> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art, COALESCE(favorite, 0) as favorite
             FROM tracks
             WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 OR album_artist LIKE ?1
             ORDER BY artist, album, track_number, title",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map([&pattern], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

pub fn get_track_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

fn path_like_pattern(root: &str) -> String {
    let escaped = root
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("{escaped}%")
}

pub fn get_track_paths_in_root(conn: &Connection, root: &str) -> Result<Vec<String>, String> {
    let pattern = path_like_pattern(root);
    let mut stmt = conn
        .prepare(
            "SELECT path
             FROM tracks
             WHERE path = ?1 OR path LIKE ?2 ESCAPE '\\'",
        )
        .map_err(|e| e.to_string())?;

    let paths = stmt
        .query_map(params![root, pattern], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(paths)
}

pub fn delete_tracks_by_paths(conn: &Connection, paths: &[String]) -> Result<(), String> {
    for chunk in paths.chunks(500) {
        let placeholders: String = chunk
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("DELETE FROM tracks WHERE path IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::types::ToSql> =
            chunk.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, params.as_slice())
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRoot {
    pub path: String,
    pub added_at: String,
    pub last_scanned_at: String,
}

pub fn upsert_library_root(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO library_roots (path, added_at, last_scanned_at)
         VALUES (?1, datetime('now'), datetime('now'))
         ON CONFLICT(path) DO UPDATE SET last_scanned_at = datetime('now')",
        params![path],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_library_roots(conn: &Connection) -> Result<Vec<LibraryRoot>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT path, added_at, last_scanned_at
             FROM library_roots
             ORDER BY path",
        )
        .map_err(|e| e.to_string())?;

    let roots = stmt
        .query_map([], |row| {
            Ok(LibraryRoot {
                path: row.get(0)?,
                added_at: row.get(1)?,
                last_scanned_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(roots)
}

pub fn delete_library_root(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM library_roots WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Track artists queries ──

pub fn upsert_track_artists(
    conn: &Connection,
    track_id: i64,
    artists: &[String],
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM track_artists WHERE track_id = ?1",
        params![track_id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("INSERT OR IGNORE INTO track_artists (track_id, artist_name) VALUES (?1, ?2)")
        .map_err(|e| e.to_string())?;

    for artist in artists {
        let trimmed = artist.trim();
        if !trimmed.is_empty() {
            stmt.execute(params![track_id, trimmed])
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistInfo {
    pub name: String,
    pub track_count: i64,
}

pub fn get_artists(conn: &Connection) -> Result<Vec<ArtistInfo>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT ta.artist_name, COUNT(DISTINCT ta.track_id) as track_count
             FROM track_artists ta
             GROUP BY ta.artist_name
             ORDER BY ta.artist_name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let artists = stmt
        .query_map([], |row| {
            Ok(ArtistInfo {
                name: row.get(0)?,
                track_count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(artists)
}

pub fn get_artist_tracks(conn: &Connection, artist: &str) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.genre,
                    t.track_number, t.disc_number, t.year, t.duration_ms, t.file_size,
                    t.format, t.sample_rate, t.bit_depth, t.has_art, COALESCE(t.favorite, 0) as favorite
             FROM tracks t
             JOIN track_artists ta ON ta.track_id = t.id
             WHERE ta.artist_name = ?1
             ORDER BY t.album, t.disc_number, t.track_number, t.title",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map(params![artist], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumInfo {
    pub album: String,
    pub album_artist: Option<String>,
    pub year: Option<i32>,
    pub track_count: i64,
    pub has_art: bool,
    pub art_track_path: Option<String>,
}

pub fn get_albums(conn: &Connection) -> Result<Vec<AlbumInfo>, String> {
    let mut stmt = conn
        .prepare(
            "WITH album_art AS (
                 SELECT album, COALESCE(album_artist, '') AS aa, MIN(path) AS art_path
                 FROM tracks
                 WHERE has_art = 1
                 GROUP BY album, COALESCE(album_artist, '')
             )
             SELECT
                 t.album,
                 t.album_artist,
                 MIN(t.year) as year,
                 COUNT(*) as track_count,
                 MAX(t.has_art) as has_art,
                 aa.art_path as art_track_path
             FROM tracks t
             LEFT JOIN album_art aa
                 ON aa.album = t.album
                 AND aa.aa = COALESCE(t.album_artist, '')
             WHERE t.album IS NOT NULL AND t.album != ''
             GROUP BY t.album, COALESCE(t.album_artist, '')
             ORDER BY t.album COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let albums = stmt
        .query_map([], |row| {
            Ok(AlbumInfo {
                album: row.get(0)?,
                album_artist: row.get(1)?,
                year: row.get(2)?,
                track_count: row.get(3)?,
                has_art: row.get::<_, i32>(4).map(|v| v != 0)?,
                art_track_path: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(albums)
}

pub fn get_album_tracks(
    conn: &Connection,
    album: &str,
    album_artist: Option<&str>,
) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art, COALESCE(favorite, 0) as favorite
             FROM tracks
             WHERE album = ?1 AND COALESCE(album_artist, '') = COALESCE(?2, '')
             ORDER BY disc_number, track_number, title",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map(params![album, album_artist], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

// ── Favorite queries ──

pub fn toggle_favorite(conn: &Connection, track_id: i64) -> Result<bool, String> {
    conn.execute(
        "UPDATE tracks SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![track_id],
    )
    .map_err(|e| e.to_string())?;

    let new_val: i32 = conn
        .query_row(
            "SELECT COALESCE(favorite, 0) FROM tracks WHERE id = ?1",
            params![track_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(new_val != 0)
}

pub fn get_favorites(conn: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art, COALESCE(favorite, 0) as favorite
             FROM tracks
             WHERE favorite = 1
             ORDER BY title COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map([], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

// ── Play history queries ──

pub fn record_play(conn: &Connection, track_id: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO play_history (track_id) VALUES (?1)",
        params![track_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_recent_plays(conn: &Connection, limit: i64) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.genre,
                    t.track_number, t.disc_number, t.year, t.duration_ms, t.file_size,
                    t.format, t.sample_rate, t.bit_depth, t.has_art, COALESCE(t.favorite, 0) as favorite
             FROM tracks t
             WHERE t.id IN (
                 SELECT track_id FROM (
                     SELECT track_id, MAX(played_at) as last_played
                     FROM play_history
                     GROUP BY track_id
                     ORDER BY last_played DESC
                     LIMIT ?1
                 )
             )
             ORDER BY (SELECT MAX(played_at) FROM play_history WHERE track_id = t.id) DESC",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map(params![limit], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

// ── Lyrics cache queries ──

pub struct CachedLyrics {
    pub synced_lyrics: Option<String>,
    pub plain_lyrics: Option<String>,
}

pub fn get_cached_lyrics(
    conn: &Connection,
    track_path: &str,
) -> Result<Option<CachedLyrics>, String> {
    let mut stmt = conn
        .prepare("SELECT synced_lyrics, plain_lyrics FROM lyrics_cache WHERE track_path = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row(params![track_path], |row| {
            Ok(CachedLyrics {
                synced_lyrics: row.get(0)?,
                plain_lyrics: row.get(1)?,
            })
        })
        .ok();

    Ok(result)
}

pub fn cache_lyrics(
    conn: &Connection,
    track_path: &str,
    synced: Option<&str>,
    plain: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO lyrics_cache (track_path, synced_lyrics, plain_lyrics, fetched_at)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![track_path, synced, plain],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Backfill track_artists for existing tracks that don't have entries yet.
pub fn rebuild_track_artists(
    conn: &Connection,
    settings: &crate::settings::AppSettings,
) -> Result<(), String> {
    use crate::library::artists::parse_artists;

    conn.execute("DELETE FROM track_artists", [])
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.artist, t.album_artist FROM tracks t
             WHERE t.artist IS NOT NULL OR t.album_artist IS NOT NULL",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, Option<String>, Option<String>)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return Ok(());
    }

    log::info!("Rebuilding track_artists for {} tracks", rows.len());

    let mut insert_stmt = conn
        .prepare("INSERT OR IGNORE INTO track_artists (track_id, artist_name) VALUES (?1, ?2)")
        .map_err(|e| e.to_string())?;

    for (track_id, artist, album_artist) in &rows {
        let mut all_artists = Vec::new();
        if let Some(a) = artist {
            all_artists.extend(parse_artists(a, settings));
        }
        if let Some(aa) = album_artist {
            all_artists.extend(parse_artists(aa, settings));
        }
        // Deduplicate
        let mut seen = std::collections::HashSet::new();
        for name in &all_artists {
            let key = name.to_lowercase();
            if seen.insert(key) && !name.trim().is_empty() {
                insert_stmt
                    .execute(params![track_id, name.trim()])
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

pub fn backfill_track_artists(
    conn: &Connection,
    settings: &crate::settings::AppSettings,
) -> Result<(), String> {
    rebuild_track_artists(conn, settings)
}

// ── Playlist queries ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub track_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn create_playlist(conn: &Connection, name: &str) -> Result<Playlist, String> {
    conn.execute("INSERT INTO playlists (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    get_playlist(conn, id)
}

pub fn get_playlist(conn: &Connection, id: i64) -> Result<Playlist, String> {
    conn.query_row(
        "SELECT p.id, p.name,
                (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id),
                p.created_at, p.updated_at
         FROM playlists p WHERE p.id = ?1",
        params![id],
        |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                track_count: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn get_all_playlists(conn: &Connection) -> Result<Vec<Playlist>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name,
                    (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id),
                    p.created_at, p.updated_at
             FROM playlists p ORDER BY p.name",
        )
        .map_err(|e| e.to_string())?;

    let playlists = stmt
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                track_count: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(playlists)
}

pub fn rename_playlist(conn: &Connection, id: i64, name: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE playlists SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_playlist(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_tracks_to_playlist(
    conn: &Connection,
    playlist_id: i64,
    track_ids: &[i64],
) -> Result<(), String> {
    let max_pos: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlist_id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    for (i, track_id) in track_ids.iter().enumerate() {
        conn.execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
            params![playlist_id, track_id, max_pos + 1 + i as i64],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?1",
        params![playlist_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn remove_track_from_playlist(
    conn: &Connection,
    playlist_id: i64,
    track_id: i64,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        params![playlist_id, track_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?1",
        params![playlist_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_playlist_tracks(conn: &Connection, playlist_id: i64) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.genre,
                    t.track_number, t.disc_number, t.year, t.duration_ms, t.file_size,
                    t.format, t.sample_rate, t.bit_depth, t.has_art, COALESCE(t.favorite, 0) as favorite
             FROM tracks t
             JOIN playlist_tracks pt ON pt.track_id = t.id
             WHERE pt.playlist_id = ?1
             ORDER BY pt.position",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map(params![playlist_id], row_to_track)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}
