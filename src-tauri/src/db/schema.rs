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

        CREATE TABLE IF NOT EXISTS play_history (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id  INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
            played_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
        CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at DESC);
        CREATE TABLE IF NOT EXISTS lyrics_cache (
            track_path    TEXT PRIMARY KEY,
            synced_lyrics TEXT,
            plain_lyrics  TEXT,
            fetched_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
        CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
        CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
        CREATE INDEX IF NOT EXISTS idx_track_artists_name ON track_artists(artist_name);
        CREATE INDEX IF NOT EXISTS idx_tracks_album_artist ON tracks(album_artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(favorite) WHERE favorite = 1;
        CREATE INDEX IF NOT EXISTS idx_play_history_composite ON play_history(played_at DESC, track_id);
        CREATE INDEX IF NOT EXISTS idx_track_artists_track_id ON track_artists(track_id);
        CREATE INDEX IF NOT EXISTS idx_tracks_album_albumartist ON tracks(album, album_artist);
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))
}

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Add favorite column if not exists
    let has_favorite = conn.prepare("SELECT favorite FROM tracks LIMIT 0").is_ok();
    if !has_favorite {
        conn.execute_batch("ALTER TABLE tracks ADD COLUMN favorite INTEGER DEFAULT 0")
            .map_err(|e| format!("Migration error: {}", e))?;
        log::info!("Added favorite column to tracks table");
    }
    Ok(())
}
