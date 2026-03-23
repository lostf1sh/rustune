pub mod queries;
pub mod schema;

use crate::settings::AppSettings;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn init_db(
    app_data_dir: &std::path::Path,
    settings: &AppSettings,
) -> Result<DbPool, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    let db_path = app_data_dir.join("rustune.db");

    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn| {
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;
             PRAGMA cache_size=-8000;
             PRAGMA synchronous=NORMAL;
             PRAGMA temp_store=MEMORY;
             PRAGMA mmap_size=268435456;",
        )
    });

    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    // Run schema creation and migrations on a single connection
    let conn = pool.get().map_err(|e| format!("Failed to get connection: {}", e))?;
    schema::create_tables(&conn)?;
    schema::run_migrations(&conn)?;
    queries::backfill_track_artists(&conn, settings)?;

    Ok(pool)
}
