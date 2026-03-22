use tauri::State;

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
) -> Result<AppSettings, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.0 = patch;
    settings::validate_settings(&mut guard.0);
    let result = guard.0.clone();
    let path = guard.1.clone();
    drop(guard);

    let json = serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub fn reset_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.0 = AppSettings::default();
    let result = guard.0.clone();
    let path = guard.1.clone();
    drop(guard);

    let json = serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save: {}", e))?;

    Ok(result)
}
