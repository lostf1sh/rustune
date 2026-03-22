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
