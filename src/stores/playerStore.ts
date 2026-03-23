import { create } from "zustand";
import { commands, type PlaybackPosition, type QueueStatePayload, type RepeatMode } from "../lib/commands";

interface PlayerStore {
  isPlaying: boolean;
  currentTrack: string | null;
  positionSecs: number;
  durationSecs: number;
  volume: number;
  queue: string[];
  queueIndex: number | null;
  shuffle: boolean;
  repeat: RepeatMode;

  updatePosition: (pos: PlaybackPosition) => void;
  updateQueueState: (qs: QueueStatePayload) => void;
  playFile: (path: string) => Promise<void>;
  playQueue: (tracks: string[], index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionSecs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
  addToQueue: (path: string) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  queueOpen: boolean;
  toggleQueue: () => void;
  nowPlayingOpen: boolean;
  toggleNowPlaying: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  positionSecs: 0,
  durationSecs: 0,
  volume: 1.0,
  queue: [],
  queueIndex: null,
  shuffle: false,
  repeat: "off",

  updatePosition: (pos: PlaybackPosition) => {
    set({
      isPlaying: pos.isPlaying,
      currentTrack: pos.currentTrack,
      positionSecs: pos.positionSecs,
      durationSecs: pos.durationSecs,
      volume: pos.volume,
    });
  },

  updateQueueState: (qs: QueueStatePayload) => {
    set({
      queue: qs.queue,
      queueIndex: qs.queueIndex,
      shuffle: qs.shuffle,
      repeat: qs.repeat,
    });
  },

  playFile: async (path: string) => {
    await commands.playFile(path);
  },

  playQueue: async (tracks: string[], index: number) => {
    await commands.playQueue(tracks, index);
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

  nextTrack: async () => {
    await commands.nextTrack();
  },

  prevTrack: async () => {
    await commands.prevTrack();
  },

  toggleShuffle: async () => {
    await commands.toggleShuffle();
  },

  cycleRepeat: async () => {
    await commands.cycleRepeat();
  },

  addToQueue: async (path: string) => {
    await commands.addToQueue(path);
  },

  removeFromQueue: async (index: number) => {
    await commands.removeFromQueue(index);
  },

  clearQueue: async () => {
    await commands.clearQueue();
  },

  queueOpen: false,
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),

  nowPlayingOpen: false,
  toggleNowPlaying: () => set((s) => ({ nowPlayingOpen: !s.nowPlayingOpen })),
}));
