import { create } from "zustand";
import { commands, type Track } from "../lib/commands";

type SortField = "title" | "artist" | "album" | "duration" | "trackNumber";
type SortDir = "asc" | "desc";

interface LibraryStore {
  tracks: Track[];
  filteredTracks: Track[];
  searchQuery: string;
  sortField: SortField;
  sortDir: SortDir;
  isScanning: boolean;
  trackCount: number;

  loadTracks: () => Promise<void>;
  scanFolder: (folder: string) => Promise<number>;
  setSearchQuery: (query: string) => void;
  setSort: (field: SortField) => void;
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

function filterTracks(tracks: Track[], query: string): Track[] {
  if (!query.trim()) return tracks;
  const q = query.toLowerCase();
  return tracks.filter(
    (t) =>
      t.title?.toLowerCase().includes(q) ||
      t.artist?.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q)
  );
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  filteredTracks: [],
  searchQuery: "",
  sortField: "title",
  sortDir: "asc",
  isScanning: false,
  trackCount: 0,

  loadTracks: async () => {
    const tracks = await commands.getTracks();
    const { searchQuery, sortField, sortDir } = get();
    const filtered = filterTracks(tracks, searchQuery);
    const sorted = sortTracks(filtered, sortField, sortDir);
    set({ tracks, filteredTracks: sorted, trackCount: tracks.length });
  },

  scanFolder: async (folder: string) => {
    set({ isScanning: true });
    try {
      const count = await commands.scanFolder(folder);
      await get().loadTracks();
      return count;
    } finally {
      set({ isScanning: false });
    }
  },

  setSearchQuery: (query: string) => {
    const { tracks, sortField, sortDir } = get();
    const filtered = filterTracks(tracks, query);
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
