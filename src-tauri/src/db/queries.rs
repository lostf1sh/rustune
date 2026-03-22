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
    conn.execute(
        "INSERT INTO tracks (path, title, artist, album, album_artist, genre, track_number, disc_number, year, duration_ms, file_size, format, sample_rate, bit_depth, has_art, modified_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))
         ON CONFLICT(path) DO UPDATE SET
            title=excluded.title, artist=excluded.artist, album=excluded.album,
            album_artist=excluded.album_artist, genre=excluded.genre,
            track_number=excluded.track_number, disc_number=excluded.disc_number,
            year=excluded.year, duration_ms=excluded.duration_ms,
            file_size=excluded.file_size, format=excluded.format,
            sample_rate=excluded.sample_rate, bit_depth=excluded.bit_depth,
            has_art=excluded.has_art, modified_at=datetime('now')",
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
    )
    .map_err(|e| format!("Failed to insert track: {}", e))?;

    Ok(conn.last_insert_rowid())
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
    })
}

pub fn get_all_tracks(conn: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art
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

pub fn search_tracks(conn: &Connection, query: &str) -> Result<Vec<Track>, String> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, path, title, artist, album, album_artist, genre,
                    track_number, disc_number, year, duration_ms, file_size,
                    format, sample_rate, bit_depth, has_art
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
    conn.execute(
        "INSERT INTO playlists (name) VALUES (?1)",
        params![name],
    )
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
                    t.format, t.sample_rate, t.bit_depth, t.has_art
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
