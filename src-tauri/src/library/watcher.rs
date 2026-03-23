use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::db::queries;
use crate::db::DbPool;
use crate::library::scanner;
use crate::settings::SettingsState;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma", "ape", "wv", "aiff", "alac",
];

const DEBOUNCE_MS: u64 = 1000;

pub struct LibraryWatcher {
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
    db: DbPool,
    app: AppHandle,
    settings: SettingsState,
}

impl LibraryWatcher {
    pub fn new(db: DbPool, app: AppHandle, settings: SettingsState) -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            db,
            app,
            settings,
        }
    }

    pub fn watch_root(&self, root: &str) -> Result<(), String> {
        if self
            .watchers
            .lock()
            .map_err(|e| e.to_string())?
            .contains_key(root)
        {
            return Ok(());
        }

        let root_str = root.to_string();
        let db = self.db.clone();
        let app = self.app.clone();
        let settings = self.settings.clone();

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher =
            notify::recommended_watcher(tx).map_err(|e| format!("Watcher error: {}", e))?;

        watcher
            .watch(Path::new(root), RecursiveMode::Recursive)
            .map_err(|e| format!("Watch error: {}", e))?;

        // Spawn handler thread
        std::thread::spawn(move || {
            handle_events(rx, db, app, settings);
        });

        self.watchers.lock().unwrap().insert(root_str, watcher);

        log::info!("Watching library root: {}", root);
        Ok(())
    }

    pub fn unwatch_root(&self, root: &str) {
        if self.watchers.lock().unwrap().remove(root).is_some() {
            log::info!("Stopped watching: {}", root);
        }
    }

    pub fn unwatch_all(&self) {
        self.watchers.lock().unwrap().clear();
        log::info!("Stopped watching all library roots");
    }

    pub fn watch_all_roots(&self) -> Result<(), String> {
        let conn = self.db.get().map_err(|e| e.to_string())?;
        let roots = queries::get_library_roots(&conn)?;
        drop(conn);

        for root in roots {
            if let Err(e) = self.watch_root(&root.path) {
                log::warn!("Failed to watch {}: {}", root.path, e);
            }
        }
        Ok(())
    }
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn handle_events(
    rx: std::sync::mpsc::Receiver<notify::Result<Event>>,
    db: DbPool,
    app: AppHandle,
    settings: SettingsState,
) {
    let mut pending: HashMap<String, Instant> = HashMap::new();

    loop {
        // Drain events with a short timeout
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(Ok(event)) => {
                for path in &event.paths {
                    if !is_audio_file(path) {
                        continue;
                    }
                    let path_str = path.to_string_lossy().to_string();
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) => {
                            pending.insert(path_str, Instant::now());
                        }
                        EventKind::Remove(_) => {
                            pending.remove(&path_str);
                            // Immediately delete removed files
                            if let Ok(conn) = db.get() {
                                queries::delete_tracks_by_paths(&conn, &[path_str]).ok();
                            }
                            app.emit("library-changed", ()).ok();
                        }
                        _ => {}
                    }
                }
            }
            Ok(Err(e)) => {
                log::warn!("Watch error: {}", e);
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return,
        }

        // Process debounced events
        let now = Instant::now();
        let ready: Vec<String> = pending
            .iter()
            .filter(|(_, ts)| now.duration_since(**ts) >= Duration::from_millis(DEBOUNCE_MS))
            .map(|(path, _)| path.clone())
            .collect();

        if !ready.is_empty() {
            if let Ok(conn) = db.get() {
                let current_settings = match settings.lock() {
                    Ok(guard) => guard.0.clone(),
                    Err(e) => {
                        log::warn!("Settings lock failed during batch rescan: {}", e);
                        for path_str in &ready {
                            pending.remove(path_str);
                        }
                        continue;
                    }
                };
                // Wrap batch of rescans in a single transaction
                conn.execute("BEGIN IMMEDIATE", []).ok();
                for path_str in &ready {
                    pending.remove(path_str);
                    if Path::new(path_str).exists() {
                        if let Err(e) = scanner::rescan_file(&conn, path_str, &current_settings) {
                            log::warn!("Rescan failed for {}: {}", path_str, e);
                        }
                    }
                }
                conn.execute("COMMIT", []).ok();
            }
            app.emit("library-changed", ()).ok();
        }
    }
}
