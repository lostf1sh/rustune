import { create } from "zustand";
import {
  commands,
  type AlbumArt,
  type LibraryRoot,
  type Track,
} from "../lib/commands";

/** Dismiss stale `searchTracks` results when the user types quickly. */
let librarySearchSeq = 0;

type SortField = "title" | "artist" | "album" | "duration" | "trackNumber";
type SortDir = "asc" | "desc";

const TRACKS_PAGE_SIZE = 2000;

interface LibraryStore {
  tracks: Track[];
  /** O(1) metadata lookup for playback bar / queue (rebuilt when `tracks` loads). */
  trackByPath: Record<string, Track>;
  filteredTracks: Track[];
  searchQuery: string;
  sortField: SortField;
  sortDir: SortDir;
  isScanning: boolean;
  trackCount: number;
  roots: LibraryRoot[];
  /** Bumps on each full library reload; album/track caches compare against this. */
  libraryRevision: number;
  /** Album grid / detail cover art by `album||albumArtist`; cleared when library reloads. */
  albumGridArtByKey: Record<string, AlbumArt | null>;

  loadTracks: () => Promise<void>;
  loadRoots: () => Promise<void>;
  scanFolder: (folder: string) => Promise<number>;
  removeRoot: (path: string) => Promise<void>;
  setSearchQuery: (query: string) => Promise<void>;
  setSort: (field: SortField) => void;
  setAlbumGridArt: (key: string, art: AlbumArt | null) => void;
  setAlbumGridArtBatch: (entries: Record<string, AlbumArt | null>) => void;
}

function sortTracks(tracks: Track[], field: SortField, dir: SortDir): Track[] {
  return [...tracks].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

    switch (field) {
      case "title":
        aVal = a.title?.toLowerCase() ?? "";
        bVal = b.title?.toLowerCase() ?? "";
        break;
      case "artist":
        aVal = a.artist?.toLowerCase() ?? "";
        bVal = b.artist?.toLowerCase() ?? "";
        break;
      case "album":
        aVal = a.album?.toLowerCase() ?? "";
        bVal = b.album?.toLowerCase() ?? "";
        break;
      case "duration":
        aVal = a.durationMs ?? 0;
        bVal = b.durationMs ?? 0;
        break;
      case "trackNumber":
        aVal = a.trackNumber ?? 9999;
        bVal = b.trackNumber ?? 9999;
        break;
    }

    if (aVal < bVal) return dir === "asc" ? -1 : 1;
    if (aVal > bVal) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  trackByPath: {},
  filteredTracks: [],
  searchQuery: "",
  sortField: "title",
  sortDir: "asc",
  isScanning: false,
  trackCount: 0,
  roots: [],
  libraryRevision: 0,
  albumGridArtByKey: {},

  loadTracks: async () => {
    const tracks: Track[] = [];
    for (let offset = 0; ; offset += TRACKS_PAGE_SIZE) {
      const chunk = await commands.getTracksPage(offset, TRACKS_PAGE_SIZE);
      if (chunk.length === 0) break;
      tracks.push(...chunk);
      if (chunk.length < TRACKS_PAGE_SIZE) break;
    }

    const trackByPath: Record<string, Track> = {};
    for (const t of tracks) {
      trackByPath[t.path] = t;
    }

    const { searchQuery, sortField, sortDir } = get();
    const filtered =
      searchQuery.trim() === ""
        ? tracks
        : await commands.searchTracks(searchQuery.trim());
    const sorted = sortTracks(filtered, sortField, sortDir);
    const nextRev = get().libraryRevision + 1;
    set({
      tracks,
      trackByPath,
      filteredTracks: sorted,
      trackCount: tracks.length,
      libraryRevision: nextRev,
      albumGridArtByKey: {},
    });
  },

  setAlbumGridArt: (key: string, art: AlbumArt | null) => {
    set((s) => ({
      albumGridArtByKey: { ...s.albumGridArtByKey, [key]: art },
    }));
  },

  setAlbumGridArtBatch: (entries: Record<string, AlbumArt | null>) => {
    set((s) => ({
      albumGridArtByKey: { ...s.albumGridArtByKey, ...entries },
    }));
  },

  loadRoots: async () => {
    const roots = await commands.getLibraryRoots();
    set({ roots });
  },

  scanFolder: async (folder: string) => {
    set({ isScanning: true });
    try {
      const count = await commands.scanFolder(folder);
      await get().loadRoots();
      await get().loadTracks();
      return count;
    } finally {
      set({ isScanning: false });
    }
  },

  removeRoot: async (path: string) => {
    await commands.removeLibraryRoot(path);
    await get().loadRoots();
    await get().loadTracks();
  },

  setSearchQuery: async (query: string) => {
    const seq = ++librarySearchSeq;
    const { sortField, sortDir } = get();
    const filtered =
      query.trim() === ""
        ? get().tracks
        : await commands.searchTracks(query.trim());
    if (seq !== librarySearchSeq) return;
    const sorted = sortTracks(filtered, sortField, sortDir);
    set({ searchQuery: query, filteredTracks: sorted });
  },

  setSort: (field: SortField) => {
    const { sortField, sortDir, filteredTracks } = get();
    const newDir = field === sortField && sortDir === "asc" ? "desc" : "asc";
    const sorted = sortTracks(filteredTracks, field, newDir);
    set({ sortField: field, sortDir: newDir, filteredTracks: sorted });
  },
}));
