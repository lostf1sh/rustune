import { invoke } from "@tauri-apps/api/core";

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack: string | null;
  positionSecs: number;
  durationSecs: number;
  volume: number;
}

export interface Track {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  durationMs: number | null;
  fileSize: number | null;
  format: string | null;
  sampleRate: number | null;
  bitDepth: number | null;
  hasArt: boolean;
}

export const commands = {
  playFile: (path: string) => invoke("play_file", { path }),
  pause: () => invoke("pause"),
  resume: () => invoke("resume"),
  stop: () => invoke("stop"),
  seek: (positionSecs: number) => invoke("seek", { positionSecs }),
  setVolume: (volume: number) => invoke("set_volume", { volume }),
  getPlaybackState: () => invoke<PlaybackState>("get_playback_state"),

  scanFolder: (folder: string) => invoke<number>("scan_folder", { folder }),
  getTracks: () => invoke<Track[]>("get_tracks"),
  searchTracks: (query: string) => invoke<Track[]>("search_tracks", { query }),
  getTrackCount: () => invoke<number>("get_track_count"),
};
