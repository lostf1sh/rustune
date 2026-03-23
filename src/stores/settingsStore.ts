import { create } from "zustand";
import { commands, type AppSettings } from "../lib/commands";

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  rebuildArtistIndex: () => Promise<void>;
}

const defaults: AppSettings = {
  autoWatch: true,
  scanOnStartup: false,
  autoFetchLyrics: true,
  preferLocalLrc: true,
  defaultVolume: 1.0,
  compactMode: false,
  showQueueBadge: true,
  customArtistSeparators: [],
  theme: "default",
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaults,
  loaded: false,

  loadSettings: async () => {
    const settings = await commands.getSettings();
    set({ settings, loaded: true });
  },

  updateSettings: async (patch: Partial<AppSettings>) => {
    const merged = { ...get().settings, ...patch };
    const saved = await commands.updateSettings(merged);
    set({ settings: saved });
  },

  resetSettings: async () => {
    const saved = await commands.resetSettings();
    set({ settings: saved });
  },

  rebuildArtistIndex: async () => {
    await commands.rebuildArtistIndex();
  },
}));
