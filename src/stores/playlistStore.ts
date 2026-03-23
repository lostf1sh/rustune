import { create } from "zustand";
import { commands, type Playlist, type Track } from "../lib/commands";

export type ViewMode = "library" | "playlist" | "artists" | "albums" | "favorites" | "recentPlays" | "settings";

interface PlaylistStore {
  playlists: Playlist[];
  activePlaylistId: number | null;
  activePlaylistTracks: Track[];
  viewMode: ViewMode;

  // Artist view
  selectedArtist: string | null;
  selectedArtistTracks: Track[];

  // Album view
  selectedAlbum: { album: string; albumArtist: string | null } | null;
  selectedAlbumTracks: Track[];

  // Favorites / Recent
  favoriteTracks: Track[];
  recentTracks: Track[];

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  viewPlaylist: (id: number) => Promise<void>;
  viewLibrary: () => void;
  viewArtists: () => void;
  selectArtist: (name: string) => Promise<void>;
  viewAlbums: () => void;
  selectAlbum: (album: string, albumArtist: string | null) => Promise<void>;
  clearAlbumSelection: () => void;
  viewFavorites: () => Promise<void>;
  viewRecentPlays: () => Promise<void>;
  viewSettings: () => void;
  refreshActiveView: () => Promise<void>;
}

const clearBrowseState = {
  activePlaylistId: null,
  activePlaylistTracks: [] as Track[],
  selectedArtist: null,
  selectedArtistTracks: [] as Track[],
  selectedAlbum: null,
  selectedAlbumTracks: [] as Track[],
  favoriteTracks: [] as Track[],
  recentTracks: [] as Track[],
};

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: [],
  activePlaylistId: null,
  activePlaylistTracks: [],
  viewMode: "library",
  selectedArtist: null,
  selectedArtistTracks: [],
  selectedAlbum: null,
  selectedAlbumTracks: [],
  favoriteTracks: [],
  recentTracks: [],

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
      set({ viewMode: "library", ...clearBrowseState });
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
    set({ viewMode: "playlist", ...clearBrowseState, activePlaylistId: id, activePlaylistTracks: tracks });
  },

  viewLibrary: () => {
    set({ viewMode: "library", ...clearBrowseState });
  },

  viewArtists: () => {
    set({ viewMode: "artists", ...clearBrowseState });
  },

  selectArtist: async (name: string) => {
    const tracks = await commands.getArtistTracks(name);
    set({ selectedArtist: name, selectedArtistTracks: tracks });
  },

  viewAlbums: () => {
    set({ viewMode: "albums", ...clearBrowseState });
  },

  selectAlbum: async (album: string, albumArtist: string | null) => {
    const tracks = await commands.getAlbumTracks(album, albumArtist);
    set({ selectedAlbum: { album, albumArtist }, selectedAlbumTracks: tracks });
  },

  clearAlbumSelection: () => {
    set({ selectedAlbum: null, selectedAlbumTracks: [] });
  },

  viewSettings: () => {
    set({ viewMode: "settings", ...clearBrowseState });
  },

  viewFavorites: async () => {
    const tracks = await commands.getFavorites();
    set({ viewMode: "favorites", ...clearBrowseState, favoriteTracks: tracks });
  },

  viewRecentPlays: async () => {
    const tracks = await commands.getRecentPlays();
    set({ viewMode: "recentPlays", ...clearBrowseState, recentTracks: tracks });
  },

  refreshActiveView: async () => {
    const {
      viewMode,
      activePlaylistId,
      selectedArtist,
      selectedAlbum,
    } = get();

    if (viewMode === "playlist" && activePlaylistId !== null) {
      const tracks = await commands.getPlaylistTracks(activePlaylistId);
      set({ activePlaylistTracks: tracks });
      return;
    }

    if (viewMode === "favorites") {
      const tracks = await commands.getFavorites();
      set({ favoriteTracks: tracks });
      return;
    }

    if (viewMode === "recentPlays") {
      const tracks = await commands.getRecentPlays();
      set({ recentTracks: tracks });
      return;
    }

    if (viewMode === "artists" && selectedArtist) {
      const tracks = await commands.getArtistTracks(selectedArtist);
      set({ selectedArtistTracks: tracks });
      return;
    }

    if (viewMode === "albums" && selectedAlbum) {
      const tracks = await commands.getAlbumTracks(
        selectedAlbum.album,
        selectedAlbum.albumArtist
      );
      set({ selectedAlbumTracks: tracks });
    }
  },
}));
