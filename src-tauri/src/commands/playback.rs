use tauri::State;

use crate::audio::engine::{AudioCommand, AudioEngine, PlaybackState};

#[tauri::command]
pub fn play_file(path: String, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::Play(path))
}

#[tauri::command]
pub fn play_queue(
    tracks: Vec<String>,
    index: usize,
    engine: State<'_, AudioEngine>,
) -> Result<(), String> {
    engine.send(AudioCommand::PlayQueue(tracks, index))
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
pub fn next_track(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::NextTrack)
}

#[tauri::command]
pub fn prev_track(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::PrevTrack)
}

#[tauri::command]
pub fn toggle_shuffle(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::ToggleShuffle)
}

#[tauri::command]
pub fn cycle_repeat(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::CycleRepeat)
}

#[tauri::command]
pub fn add_to_queue(path: String, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::AddToQueue(path))
}

#[tauri::command]
pub fn remove_from_queue(index: usize, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::RemoveFromQueue(index))
}

#[tauri::command]
pub fn insert_next_in_queue(path: String, engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::InsertNextInQueue(path))
}

#[tauri::command]
pub fn clear_queue(engine: State<'_, AudioEngine>) -> Result<(), String> {
    engine.send(AudioCommand::ClearQueue)
}

#[tauri::command]
pub fn get_playback_state(engine: State<'_, AudioEngine>) -> PlaybackState {
    engine.get_state()
}
