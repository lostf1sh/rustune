use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_true")]
    pub auto_watch: bool,
    #[serde(default)]
    pub scan_on_startup: bool,
    #[serde(default = "default_true")]
    pub auto_fetch_lyrics: bool,
    #[serde(default = "default_true")]
    pub prefer_local_lrc: bool,
    #[serde(default = "default_volume")]
    pub default_volume: f32,
    #[serde(default)]
    pub compact_mode: bool,
    #[serde(default = "default_true")]
    pub show_queue_badge: bool,
}

fn default_true() -> bool {
    true
}

fn default_volume() -> f32 {
    1.0
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_watch: true,
            scan_on_startup: false,
            auto_fetch_lyrics: true,
            prefer_local_lrc: true,
            default_volume: 1.0,
            compact_mode: false,
            show_queue_badge: true,
        }
    }
}

pub type SettingsState = Mutex<(AppSettings, PathBuf)>;

pub fn load_settings(app_data_dir: &Path) -> (AppSettings, PathBuf) {
    let config_path = app_data_dir.join("settings.json");

    if config_path.exists() {
        match std::fs::read_to_string(&config_path) {
            Ok(content) => {
                // Deserialize with defaults for missing keys
                match serde_json::from_str::<AppSettings>(&content) {
                    Ok(settings) => {
                        // Re-save to persist any new default fields
                        save_settings_to_path(&settings, &config_path).ok();
                        return (settings, config_path);
                    }
                    Err(e) => {
                        log::warn!("Failed to parse settings, using defaults: {}", e);
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read settings file: {}", e);
            }
        }
    }

    let settings = AppSettings::default();
    save_settings_to_path(&settings, &config_path).ok();
    (settings, config_path)
}

fn save_settings_to_path(settings: &AppSettings, path: &Path) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("Failed to save settings: {}", e))
}

pub fn save_settings(state: &SettingsState) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    save_settings_to_path(&guard.0, &guard.1)
}

pub fn validate_settings(settings: &mut AppSettings) {
    settings.default_volume = settings.default_volume.clamp(0.0, 1.0);
}
