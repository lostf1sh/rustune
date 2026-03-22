pub mod queries;
pub mod schema;

use rusqlite::Connection;
use std::sync::Mutex;

pub type DbConn = Mutex<Connection>;

pub fn init_db(app_data_dir: &std::path::Path) -> Result<Connection, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    let db_path = app_data_dir.join("rustune.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;
    schema::create_tables(&conn)?;
    schema::run_migrations(&conn)?;
    queries::backfill_track_artists(&conn)?;
    Ok(conn)
}
