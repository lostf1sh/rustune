use tauri::State;

use crate::audio::engine::{AudioCommand, AudioEngine, PlaybackState};

#[tauri::command]
pub fn play_file(path: String, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Play(path))
}

#[tauri::command]
pub fn pause(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Pause)
}

#[tauri::command]
pub fn resume(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Resume)
}

#[tauri::command]
pub fn stop(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Stop)
}

#[tauri::command]
pub fn seek(position_secs: f64, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Seek(position_secs))
}

#[tauri::command]
pub fn set_volume(volume: f32, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::SetVolume(volume))
}

#[tauri::command]
pub fn get_playback_state(engine: State<'_, AudioEngine>) -> PlaybackState {
    engine.get_state()
}
