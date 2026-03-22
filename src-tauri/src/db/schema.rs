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

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
            track_id    INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
            position    INTEGER NOT NULL,
            PRIMARY KEY (playlist_id, track_id)
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
        CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))
}
