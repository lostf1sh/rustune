import { create } from "zustand";
import { commands, type PlaybackState } from "../lib/commands";

interface PlayerStore {
  isPlaying: boolean;
  currentTrack: string | null;
  positionSecs: number;
  durationSecs: number;
  volume: number;

  updateFromBackend: (state: PlaybackState) => void;
  playFile: (path: string) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionSecs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  positionSecs: 0,
  durationSecs: 0,
  volume: 1.0,

  updateFromBackend: (state: PlaybackState) => {
    set({
      isPlaying: state.isPlaying,
      currentTrack: state.currentTrack,
      positionSecs: state.positionSecs,
      durationSecs: state.durationSecs,
      volume: state.volume,
    });
  },

  playFile: async (path: string) => {
    await commands.playFile(path);
  },

  togglePlayPause: async () => {
    if (get().isPlaying) {
      await commands.pause();
    } else {
      await commands.resume();
    }
  },

  stop: async () => {
    await commands.stop();
  },

  seek: async (positionSecs: number) => {
    await commands.seek(positionSecs);
  },

  setVolume: async (volume: number) => {
    await commands.setVolume(volume);
    set({ volume });
  },
}));
