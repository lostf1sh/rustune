use rusqlite::Connection;

pub fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS tracks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            path         TEXT NOT NULL UNIQUE,
            title        TEXT,
            artist       TEXT,
            album        TEXT,
            album_artist TEXT,
            genre        TEXT,
            track_number INTEGER,
            disc_number  INTEGER,
            year         INTEGER,
            duration_ms  INTEGER,
            file_size    INTEGER,
            format       TEXT,
            sample_rate  INTEGER,
            bit_depth    INTEGER,
            has_art      INTEGER DEFAULT 0,
            added_at     TEXT DEFAULT (datetime('now')),
            modified_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS library_roots (
            path            TEXT PRIMARY KEY,
            added_at        TEXT DEFAULT (datetime('now')),
            last_scanned_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
            track_id    INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
            position    INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, track_id)
        );

        CREATE TABLE IF NOT EXISTS track_artists (
            track_id    INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
            artist_name TEXT NOT NULL,
            PRIMARY KEY (track_id, artist_name)
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
        CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
        CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
        CREATE INDEX IF NOT EXISTS idx_track_artists_name ON track_artists(artist_name);
        CREATE INDEX IF NOT EXISTS idx_tracks_album_artist ON tracks(album_artist);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))
}
