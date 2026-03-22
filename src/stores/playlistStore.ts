import { create } from "zustand";
import { commands, type Playlist, type Track } from "../lib/commands";

export type ViewMode = "library" | "playlist";

interface PlaylistStore {
  playlists: Playlist[];
  activePlaylistId: number | null;
  activePlaylistTracks: Track[];
  viewMode: ViewMode;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  viewPlaylist: (id: number) => Promise<void>;
  viewLibrary: () => void;
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: [],
  activePlaylistId: null,
  activePlaylistTracks: [],
  viewMode: "library",

  loadPlaylists: async () => {
    const playlists = await commands.getPlaylists();
    set({ playlists });
  },

  createPlaylist: async (name: string) => {
    const playlist = await commands.createPlaylist(name);
    await get().loadPlaylists();
    return playlist;
  },

  renamePlaylist: async (id: number, name: string) => {
    await commands.renamePlaylist(id, name);
    await get().loadPlaylists();
  },

  deletePlaylist: async (id: number) => {
    await commands.deletePlaylist(id);
    if (get().activePlaylistId === id) {
      set({ viewMode: "library", activePlaylistId: null, activePlaylistTracks: [] });
    }
    await get().loadPlaylists();
  },

  addTracksToPlaylist: async (playlistId: number, trackIds: number[]) => {
    await commands.addTracksToPlaylist(playlistId, trackIds);
    await get().loadPlaylists();
    if (get().activePlaylistId === playlistId) {
      const tracks = await commands.getPlaylistTracks(playlistId);
      set({ activePlaylistTracks: tracks });
    }
  },

  removeTrackFromPlaylist: async (playlistId: number, trackId: number) => {
    await commands.removeTrackFromPlaylist(playlistId, trackId);
    await get().loadPlaylists();
    if (get().activePlaylistId === playlistId) {
      const tracks = await commands.getPlaylistTracks(playlistId);
      set({ activePlaylistTracks: tracks });
    }
  },

  viewPlaylist: async (id: number) => {
    const tracks = await commands.getPlaylistTracks(id);
    set({ viewMode: "playlist", activePlaylistId: id, activePlaylistTracks: tracks });
  },

  viewLibrary: () => {
    set({ viewMode: "library", activePlaylistId: null, activePlaylistTracks: [] });
  },
}));
