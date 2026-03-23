use tauri::{AppHandle, Emitter, State};

use crate::db::queries;
use crate::db::DbConn;
use crate::library::watcher::LibraryWatcher;
use crate::settings::{self, AppSettings, SettingsState};

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(guard.0.clone())
}

#[tauri::command]
pub fn update_settings(
    patch: AppSettings,
    state: State<'_, SettingsState>,
    watcher: State<'_, LibraryWatcher>,
) -> Result<AppSettings, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let old_auto_watch = guard.0.auto_watch;
    guard.0 = patch;
    settings::validate_settings(&mut guard.0);
    let result = guard.0.clone();
    drop(guard);

    settings::save_settings(&state)?;

    if old_auto_watch != result.auto_watch {
        if result.auto_watch {
            watcher.watch_all_roots().ok();
        } else {
            watcher.unwatch_all();
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn reset_settings(
    state: State<'_, SettingsState>,
    watcher: State<'_, LibraryWatcher>,
) -> Result<AppSettings, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let old_auto_watch = guard.0.auto_watch;
    guard.0 = AppSettings::default();
    let result = guard.0.clone();
    drop(guard);

    settings::save_settings(&state)?;

    if old_auto_watch != result.auto_watch {
        if result.auto_watch {
            watcher.watch_all_roots().ok();
        } else {
            watcher.unwatch_all();
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn rebuild_artist_index(
    db: State<'_, DbConn>,
    state: State<'_, SettingsState>,
    app: AppHandle,
) -> Result<(), String> {
    let settings = state.lock().map_err(|e| e.to_string())?.0.clone();
    let conn = db.lock().map_err(|e| e.to_string())?;
    queries::rebuild_track_artists(&conn, &settings)?;
    app.emit("library-changed", ()).ok();
    Ok(())
}
