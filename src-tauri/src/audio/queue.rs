use rand::seq::SliceRandom;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueState {
    pub tracks: Vec<String>,
    pub current_index: Option<usize>,
    pub shuffle: bool,
    pub repeat: RepeatMode,
    /// The original order before shuffle, so we can unshuffle
    pub original_tracks: Vec<String>,
}

impl Default for QueueState {
    fn default() -> Self {
        Self {
            tracks: Vec::new(),
            current_index: None,
            shuffle: false,
            repeat: RepeatMode::Off,
            original_tracks: Vec::new(),
        }
    }
}

impl QueueState {
    pub fn set_tracks(&mut self, tracks: Vec<String>, start_index: usize) {
        self.original_tracks = tracks.clone();
        if self.shuffle {
            let current = tracks[start_index].clone();
            let mut rest: Vec<String> = tracks
                .into_iter()
                .enumerate()
                .filter(|(i, _)| *i != start_index)
                .map(|(_, t)| t)
                .collect();
            rest.shuffle(&mut rand::thread_rng());
            self.tracks = std::iter::once(current).chain(rest).collect();
            self.current_index = Some(0);
        } else {
            self.tracks = tracks;
            self.current_index = Some(start_index);
        }
    }

    pub fn current_track(&self) -> Option<&str> {
        self.current_index
            .and_then(|i| self.tracks.get(i))
            .map(|s| s.as_str())
    }

    pub fn next_track(&mut self) -> Option<&str> {
        let idx = self.current_index?;
        let len = self.tracks.len();
        if len == 0 {
            return None;
        }

        match self.repeat {
            RepeatMode::One => {
                // Stay on same track
                self.tracks.get(idx).map(|s| s.as_str())
            }
            RepeatMode::All => {
                let next = (idx + 1) % len;
                self.current_index = Some(next);
                self.tracks.get(next).map(|s| s.as_str())
            }
            RepeatMode::Off => {
                if idx + 1 < len {
                    self.current_index = Some(idx + 1);
                    self.tracks.get(idx + 1).map(|s| s.as_str())
                } else {
                    self.current_index = None;
                    None
                }
            }
        }
    }

    pub fn prev_track(&mut self) -> Option<&str> {
        let idx = self.current_index?;
        if idx > 0 {
            self.current_index = Some(idx - 1);
            self.tracks.get(idx - 1).map(|s| s.as_str())
        } else if self.repeat == RepeatMode::All && !self.tracks.is_empty() {
            let last = self.tracks.len() - 1;
            self.current_index = Some(last);
            self.tracks.get(last).map(|s| s.as_str())
        } else {
            self.tracks.first().map(|s| s.as_str())
        }
    }

    pub fn toggle_shuffle(&mut self) {
        self.shuffle = !self.shuffle;
        if self.tracks.is_empty() {
            return;
        }

        let current_track = self.current_track().map(|s| s.to_string());

        if self.shuffle {
            // Shuffle: put current track first, shuffle the rest
            if let Some(ref current) = current_track {
                let mut rest: Vec<String> = self
                    .tracks
                    .iter()
                    .filter(|t| t.as_str() != current.as_str())
                    .cloned()
                    .collect();
                rest.shuffle(&mut rand::thread_rng());
                self.tracks = std::iter::once(current.clone()).chain(rest).collect();
                self.current_index = Some(0);
            }
        } else {
            // Unshuffle: restore original order
            if !self.original_tracks.is_empty() {
                let current_path = current_track.as_deref();
                self.tracks = self.original_tracks.clone();
                self.current_index =
                    current_path.and_then(|p| self.tracks.iter().position(|t| t == p));
            }
        }
    }

    pub fn cycle_repeat(&mut self) -> RepeatMode {
        self.repeat = match self.repeat {
            RepeatMode::Off => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::Off,
        };
        self.repeat
    }

    pub fn add_track(&mut self, path: String) {
        self.original_tracks.push(path.clone());
        self.tracks.push(path);
        if self.current_index.is_none() {
            self.current_index = Some(0);
        }
    }

    pub fn remove_track(&mut self, index: usize) {
        if index >= self.tracks.len() {
            return;
        }
        let removed = self.tracks.remove(index);
        self.original_tracks.retain(|t| t != &removed);

        if let Some(current) = self.current_index {
            if index < current {
                self.current_index = Some(current - 1);
            } else if index == current {
                if self.tracks.is_empty() {
                    self.current_index = None;
                } else if current >= self.tracks.len() {
                    self.current_index = Some(self.tracks.len() - 1);
                }
            }
        }
    }

    pub fn clear(&mut self) {
        self.tracks.clear();
        self.original_tracks.clear();
        self.current_index = None;
    }
}
