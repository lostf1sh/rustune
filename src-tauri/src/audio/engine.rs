use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::decoder::Decoder;
use super::output::AudioOutput;
use super::queue::{QueueState, RepeatMode};

#[derive(Debug)]
pub enum AudioCommand {
    Play(String),
    PlayQueue(Vec<String>, usize),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
    NextTrack,
    PrevTrack,
    ToggleShuffle,
    CycleRepeat,
    AddToQueue(String),
    RemoveFromQueue(usize),
    InsertNextInQueue(String),
    ClearQueue,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub is_playing: bool,
    pub current_track: Option<String>,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub volume: f32,
    pub queue: Vec<String>,
    pub queue_index: Option<usize>,
    pub shuffle: bool,
    pub repeat: RepeatMode,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_track: None,
            position_secs: 0.0,
            duration_secs: 0.0,
            volume: 1.0,
            queue: Vec::new(),
            queue_index: None,
            shuffle: false,
            repeat: RepeatMode::Off,
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

const MAX_BUFFER_SAMPLES: usize = 48000 * 2 / 5;
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
    let mut queue = QueueState::default();

    loop {
        // Process all pending commands
        loop {
            match rx.try_recv() {
                Ok(AudioCommand::Play(path)) => {
                    queue.set_tracks(vec![path], 0);
                    start_track(&queue, &mut decoder, &mut audio_output, &state, &mut paused);
                }
                Ok(AudioCommand::PlayQueue(tracks, index)) => {
                    queue.set_tracks(tracks, index);
                    start_track(&queue, &mut decoder, &mut audio_output, &state, &mut paused);
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
                    queue.clear();
                    paused = false;
                    let mut s = state.lock().unwrap();
                    s.is_playing = false;
                    s.current_track = None;
                    s.position_secs = 0.0;
                    s.duration_secs = 0.0;
                    sync_queue_state(&queue, &mut s);
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
                Ok(AudioCommand::NextTrack) => {
                    if queue.next_track().is_some() {
                        start_track(&queue, &mut decoder, &mut audio_output, &state, &mut paused);
                    }
                }
                Ok(AudioCommand::PrevTrack) => {
                    // If past 3 seconds, restart current track instead
                    let pos = state.lock().unwrap().position_secs;
                    if pos > 3.0 {
                        if let Some(ref out) = audio_output {
                            out.clear();
                        }
                        if let Some(ref mut dec) = decoder {
                            dec.seek(0.0);
                            state.lock().unwrap().position_secs = 0.0;
                        }
                    } else if queue.prev_track().is_some() {
                        start_track(&queue, &mut decoder, &mut audio_output, &state, &mut paused);
                    }
                }
                Ok(AudioCommand::ToggleShuffle) => {
                    queue.toggle_shuffle();
                    let mut s = state.lock().unwrap();
                    sync_queue_state(&queue, &mut s);
                }
                Ok(AudioCommand::CycleRepeat) => {
                    queue.cycle_repeat();
                    let mut s = state.lock().unwrap();
                    sync_queue_state(&queue, &mut s);
                }
                Ok(AudioCommand::AddToQueue(path)) => {
                    queue.add_track(path);
                    let mut s = state.lock().unwrap();
                    sync_queue_state(&queue, &mut s);
                }
                Ok(AudioCommand::RemoveFromQueue(index)) => {
                    queue.remove_track(index);
                    let mut s = state.lock().unwrap();
                    sync_queue_state(&queue, &mut s);
                }
                Ok(AudioCommand::InsertNextInQueue(path)) => {
                    queue.insert_after_current(path);
                    let mut s = state.lock().unwrap();
                    sync_queue_state(&queue, &mut s);
                }
                Ok(AudioCommand::ClearQueue) => {
                    if let Some(ref out) = audio_output {
                        out.clear();
                    }
                    decoder.take();
                    queue.clear();
                    paused = false;
                    let mut s = state.lock().unwrap();
                    s.is_playing = false;
                    s.current_track = None;
                    s.position_secs = 0.0;
                    s.duration_secs = 0.0;
                    sync_queue_state(&queue, &mut s);
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => return,
            }
        }

        // Decode and fill buffer
        if !paused {
            if let Some(ref mut dec) = decoder {
                if let Some(ref out) = audio_output {
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
                                // Track finished — auto-advance
                                decoder.take();
                                if queue.next_track().is_some() {
                                    start_track(
                                        &queue,
                                        &mut decoder,
                                        &mut audio_output,
                                        &state,
                                        &mut paused,
                                    );
                                } else {
                                    let mut s = state.lock().unwrap();
                                    s.is_playing = false;
                                    s.position_secs = s.duration_secs;
                                    sync_queue_state(&queue, &mut s);
                                    app.emit("track-ended", ()).ok();
                                }
                            }
                        }
                    } else {
                        thread::sleep(Duration::from_millis(5));
                    }
                }
            }
        }

        if last_emit.elapsed() >= EMIT_INTERVAL {
            let s = state.lock().unwrap().clone();
            app.emit("playback-state", s).ok();
            last_emit = Instant::now();
        }

        if paused || decoder.is_none() {
            thread::sleep(Duration::from_millis(30));
        }
    }
}

fn start_track(
    queue: &QueueState,
    decoder: &mut Option<Decoder>,
    audio_output: &mut Option<AudioOutput>,
    state: &Arc<Mutex<PlaybackState>>,
    paused: &mut bool,
) {
    if let Some(ref out) = audio_output {
        out.clear();
    }
    decoder.take();
    *paused = false;

    let path = match queue.current_track() {
        Some(p) => p.to_string(),
        None => return,
    };

    match Decoder::new(&path) {
        Ok(dec) => {
            let duration = dec.duration_secs();
            let spec = dec.signal_spec();
            let sample_rate = spec.rate;
            let channels = spec.channels.count() as u16;

            let needs_new = audio_output
                .as_ref()
                .map(|o| !o.matches(sample_rate, channels))
                .unwrap_or(true);

            if needs_new {
                audio_output.take();
                match AudioOutput::new(sample_rate, channels) {
                    Ok(out) => *audio_output = Some(out),
                    Err(e) => {
                        log::error!("Failed to create audio output: {}", e);
                        let mut s = state.lock().unwrap();
                        s.is_playing = false;
                        return;
                    }
                }
            }

            {
                let mut s = state.lock().unwrap();
                s.is_playing = true;
                s.current_track = Some(path.clone());
                s.position_secs = 0.0;
                s.duration_secs = duration;
                sync_queue_state(queue, &mut s);
            }
            *decoder = Some(dec);
            log::info!("Playing: {}", path);
        }
        Err(e) => {
            log::error!("Failed to open file: {}", e);
            let mut s = state.lock().unwrap();
            s.is_playing = false;
        }
    }
}

fn sync_queue_state(queue: &QueueState, state: &mut PlaybackState) {
    state.queue = queue.tracks.clone();
    state.queue_index = queue.current_index;
    state.shuffle = queue.shuffle;
    state.repeat = queue.repeat;
}
