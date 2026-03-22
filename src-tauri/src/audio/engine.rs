use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::decoder::Decoder;
use super::output::AudioOutput;

#[derive(Debug)]
pub enum AudioCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub is_playing: bool,
    pub current_track: Option<String>,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub volume: f32,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_track: None,
            position_secs: 0.0,
            duration_secs: 0.0,
            volume: 1.0,
        }
    }
}

pub struct AudioEngine {
    pub command_tx: mpsc::Sender<AudioCommand>,
    pub state: Arc<Mutex<PlaybackState>>,
}

impl AudioEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        let (command_tx, command_rx) = mpsc::channel::<AudioCommand>();
        let state = Arc::new(Mutex::new(PlaybackState::default()));
        let state_clone = Arc::clone(&state);

        thread::spawn(move || {
            audio_thread_main(command_rx, state_clone, app_handle);
        });

        Self { command_tx, state }
    }

    pub fn send(&self, cmd: AudioCommand) -> Result<(), String> {
        self.command_tx.send(cmd).map_err(|e| e.to_string())
    }

    pub fn get_state(&self) -> PlaybackState {
        self.state.lock().unwrap().clone()
    }
}

// Max buffered audio before we pause decoding (~200ms at 48kHz stereo)
const MAX_BUFFER_SAMPLES: usize = 48000 * 2 / 5;
// How often to emit state to frontend
const EMIT_INTERVAL: Duration = Duration::from_millis(100);

fn audio_thread_main(
    rx: mpsc::Receiver<AudioCommand>,
    state: Arc<Mutex<PlaybackState>>,
    app: AppHandle,
) {
    let mut decoder: Option<Decoder> = None;
    let mut audio_output: Option<AudioOutput> = None;
    let mut paused = false;
    let mut last_emit = Instant::now();

    loop {
        // Process all pending commands
        loop {
            match rx.try_recv() {
                Ok(AudioCommand::Play(path)) => {
                    // Clear buffer immediately for instant response
                    if let Some(ref out) = audio_output {
                        out.clear();
                    }
                    decoder.take();
                    paused = false;

                    match Decoder::new(&path) {
                        Ok(dec) => {
                            let duration = dec.duration_secs();
                            let spec = dec.signal_spec();
                            let sample_rate = spec.rate;
                            let channels = spec.channels.count() as u16;

                            // Reuse output if format matches, otherwise recreate
                            let needs_new_output = audio_output
                                .as_ref()
                                .map(|o| !o.matches(sample_rate, channels))
                                .unwrap_or(true);

                            if needs_new_output {
                                audio_output.take();
                                match AudioOutput::new(sample_rate, channels) {
                                    Ok(out) => audio_output = Some(out),
                                    Err(e) => {
                                        log::error!("Failed to create audio output: {}", e);
                                        let mut s = state.lock().unwrap();
                                        s.is_playing = false;
                                        s.current_track = None;
                                        continue;
                                    }
                                }
                            }

                            {
                                let mut s = state.lock().unwrap();
                                s.is_playing = true;
                                s.current_track = Some(path.clone());
                                s.position_secs = 0.0;
                                s.duration_secs = duration;
                            }
                            decoder = Some(dec);
                            log::info!("Playing: {}", path);
                        }
                        Err(e) => {
                            log::error!("Failed to open file: {}", e);
                            let mut s = state.lock().unwrap();
                            s.is_playing = false;
                            s.current_track = None;
                        }
                    }
                }
                Ok(AudioCommand::Pause) => {
                    paused = true;
                    state.lock().unwrap().is_playing = false;
                }
                Ok(AudioCommand::Resume) => {
                    if decoder.is_some() {
                        paused = false;
                        state.lock().unwrap().is_playing = true;
                    }
                }
                Ok(AudioCommand::Stop) => {
                    if let Some(ref out) = audio_output {
                        out.clear();
                    }
                    decoder.take();
                    paused = false;
                    let mut s = state.lock().unwrap();
                    s.is_playing = false;
                    s.current_track = None;
                    s.position_secs = 0.0;
                    s.duration_secs = 0.0;
                }
                Ok(AudioCommand::Seek(pos)) => {
                    if let Some(ref out) = audio_output {
                        out.clear();
                    }
                    if let Some(ref mut dec) = decoder {
                        dec.seek(pos);
                        state.lock().unwrap().position_secs = pos;
                    }
                }
                Ok(AudioCommand::SetVolume(vol)) => {
                    state.lock().unwrap().volume = vol.clamp(0.0, 1.0);
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => return,
            }
        }

        // Decode and fill buffer
        if !paused {
            if let Some(ref mut dec) = decoder {
                if let Some(ref out) = audio_output {
                    // Only decode if buffer isn't too full
                    if out.buffered_samples() < MAX_BUFFER_SAMPLES {
                        let volume = state.lock().unwrap().volume;
                        match dec.next_samples() {
                            Some(samples) => {
                                let samples: Vec<f32> =
                                    samples.iter().map(|s| s * volume).collect();
                                out.write(&samples);

                                let pos = dec.position_secs();
                                state.lock().unwrap().position_secs = pos;
                            }
                            None => {
                                // Track finished
                                decoder.take();
                                let mut s = state.lock().unwrap();
                                s.is_playing = false;
                                s.position_secs = s.duration_secs;
                                app.emit("track-ended", ()).ok();
                                log::info!("Track finished");
                            }
                        }
                    } else {
                        // Buffer full, sleep briefly to avoid busy-spinning
                        thread::sleep(Duration::from_millis(5));
                    }
                }
            }
        }

        // Emit state to frontend at regular intervals
        if last_emit.elapsed() >= EMIT_INTERVAL {
            let s = state.lock().unwrap().clone();
            app.emit("playback-state", s).ok();
            last_emit = Instant::now();
        }

        // Sleep when idle to avoid CPU burn
        if paused || decoder.is_none() {
            thread::sleep(Duration::from_millis(30));
        }
    }
}
