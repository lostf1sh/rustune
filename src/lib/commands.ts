import { invoke } from "@tauri-apps/api/core";

export type RepeatMode = "off" | "one" | "all";

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack: string | null;
  positionSecs: number;
  durationSecs: number;
  volume: number;
  queue: string[];
  queueIndex: number | null;
  shuffle: boolean;
  repeat: RepeatMode;
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
  favorite: boolean;
}

export interface LyricsLine {
  timeMs: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricsLine[] | null;
  plain: string | null;
}

export interface TagInfo {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
}

export interface TagUpdate {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  genre?: string | null;
  year?: number | null;
  trackNumber?: number | null;
  discNumber?: number | null;
}

export interface AlbumArt {
  data: string;
  mimeType: string;
}

export interface Playlist {
  id: number;
  name: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtistInfo {
  name: string;
  trackCount: number;
}

export interface AlbumInfo {
  album: string;
  albumArtist: string | null;
  year: number | null;
  trackCount: number;
  hasArt: boolean;
  artTrackPath: string | null;
}

export interface LibraryRoot {
  path: string;
  addedAt: string;
  lastScannedAt: string;
}

export const commands = {
  playFile: (path: string) => invoke("play_file", { path }),
  playQueue: (tracks: string[], index: number) =>
    invoke("play_queue", { tracks, index }),
  pause: () => invoke("pause"),
  resume: () => invoke("resume"),
  stop: () => invoke("stop"),
  seek: (positionSecs: number) => invoke("seek", { positionSecs }),
  setVolume: (volume: number) => invoke("set_volume", { volume }),
  nextTrack: () => invoke("next_track"),
  prevTrack: () => invoke("prev_track"),
  toggleShuffle: () => invoke("toggle_shuffle"),
  cycleRepeat: () => invoke("cycle_repeat"),
  addToQueue: (path: string) => invoke("add_to_queue", { path }),
  removeFromQueue: (index: number) => invoke("remove_from_queue", { index }),
  clearQueue: () => invoke("clear_queue"),
  getPlaybackState: () => invoke<PlaybackState>("get_playback_state"),

  scanFolder: (folder: string) => invoke<number>("scan_folder", { folder }),
  getTracks: () => invoke<Track[]>("get_tracks"),
  searchTracks: (query: string) => invoke<Track[]>("search_tracks", { query }),
  getTrackCount: () => invoke<number>("get_track_count"),
  getLibraryRoots: () => invoke<LibraryRoot[]>("get_library_roots"),
  removeLibraryRoot: (path: string) => invoke("remove_library_root", { path }),
  getArtists: () => invoke<ArtistInfo[]>("get_artists"),
  getArtistTracks: (artist: string) => invoke<Track[]>("get_artist_tracks", { artist }),
  getAlbums: () => invoke<AlbumInfo[]>("get_albums"),
  getAlbumTracks: (album: string, albumArtist: string | null) =>
    invoke<Track[]>("get_album_tracks", { album, albumArtist }),
  toggleFavorite: (trackId: number) => invoke<boolean>("toggle_favorite", { trackId }),
  getFavorites: () => invoke<Track[]>("get_favorites"),
  recordPlay: (trackId: number) => invoke("record_play", { trackId }),
  getRecentPlays: (limit?: number) => invoke<Track[]>("get_recent_plays", { limit: limit ?? 50 }),
  insertNextInQueue: (path: string) => invoke("insert_next_in_queue", { path }),

  createPlaylist: (name: string) => invoke<Playlist>("create_playlist", { name }),
  getPlaylists: () => invoke<Playlist[]>("get_playlists"),
  renamePlaylist: (id: number, name: string) =>
    invoke("rename_playlist", { id, name }),
  deletePlaylist: (id: number) => invoke("delete_playlist", { id }),
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) =>
    invoke("add_tracks_to_playlist", { playlistId, trackIds }),
  removeTrackFromPlaylist: (playlistId: number, trackId: number) =>
    invoke("remove_track_from_playlist", { playlistId, trackId }),
  getPlaylistTracks: (playlistId: number) =>
    invoke<Track[]>("get_playlist_tracks", { playlistId }),

  getAlbumArt: (path: string) =>
    invoke<AlbumArt | null>("get_album_art", { path }),

  readTags: (path: string) => invoke<TagInfo>("read_tags", { path }),
  writeTags: (path: string, tags: TagUpdate) =>
    invoke("write_tags", { path, tags }),

  fetchLyrics: (trackPath: string, title: string, artist: string, album: string, durationSecs: number) =>
    invoke<LyricsResult>("fetch_lyrics", { trackPath, title, artist, album, durationSecs }),
};
