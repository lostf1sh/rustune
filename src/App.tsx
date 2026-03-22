import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { PlayerBar } from "./components/PlayerBar/PlayerBar";
import { QueuePanel } from "./components/QueuePanel/QueuePanel";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TrackList } from "./components/TrackList/TrackList";
import { ArtistView } from "./components/ArtistView/ArtistView";
import { AlbumView } from "./components/AlbumView/AlbumView";
import { NowPlaying } from "./components/NowPlaying/NowPlaying";
import { SettingsView } from "./components/SettingsView/SettingsView";
import { usePlayerStore } from "./stores/playerStore";
import { useLibraryStore } from "./stores/libraryStore";
import { usePlaylistStore } from "./stores/playlistStore";
import { useSettingsStore } from "./stores/settingsStore";
import { commands, type PlaybackState } from "./lib/commands";
import styles from "./App.module.css";

function App() {
  const updateFromBackend = usePlayerStore((s) => s.updateFromBackend);
  const nowPlayingOpen = usePlayerStore((s) => s.nowPlayingOpen);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const loadRoots = useLibraryStore((s) => s.loadRoots);
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);
  const viewMode = usePlaylistStore((s) => s.viewMode);

  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadTracks();
    loadRoots();
    loadPlaylists();
    loadSettings();
  }, [loadTracks, loadRoots, loadPlaylists, loadSettings]);

  // Auto-reload library on filesystem changes
  useEffect(() => {
    const unlisten = listen("library-changed", () => {
      loadTracks();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadTracks]);

  // Playback state listener + window title update
  useEffect(() => {
    const unlisten = listen<PlaybackState>("playback-state", (event) => {
      updateFromBackend(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateFromBackend]);

  // Record play history when track changes
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const tracks = useLibraryStore((s) => s.tracks);
  const prevTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentTrack && currentTrack !== prevTrackRef.current) {
      prevTrackRef.current = currentTrack;
      const meta = tracks.find((t) => t.path === currentTrack);
      if (meta) {
        commands.recordPlay(meta.id);
      }
    }
  }, [currentTrack, tracks]);

  // Update window title with current track

  useEffect(() => {
    const meta = tracks.find((t) => t.path === currentTrack);
    if (meta?.title) {
      const parts = [meta.title, meta.artist].filter(Boolean).join(" — ");
      getCurrentWindow().setTitle(`${parts} · Rustune`).catch(() => {});
    } else {
      getCurrentWindow().setTitle("Rustune").catch(() => {});
    }
  }, [currentTrack, tracks]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const state = usePlayerStore.getState();

      switch (e.key) {
        case " ":
          e.preventDefault();
          state.togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            state.nextTrack();
          } else {
            state.seek(Math.min(state.positionSecs + 5, state.durationSecs));
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            state.prevTrack();
          } else {
            state.seek(Math.max(state.positionSecs - 5, 0));
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          state.setVolume(Math.min(state.volume + 0.05, 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          state.setVolume(Math.max(state.volume - 0.05, 0));
          break;
        case "m":
        case "M":
          state.setVolume(state.volume > 0 ? 0 : 1);
          break;
        case "s":
        case "S":
          if (!e.ctrlKey && !e.metaKey) state.toggleShuffle();
          break;
        case "r":
        case "R":
          state.cycleRepeat();
          break;
        case "q":
        case "Q":
          state.toggleQueue();
          break;
        case "Escape":
          if (state.nowPlayingOpen) {
            state.toggleNowPlaying();
          } else if (state.queueOpen) {
            state.toggleQueue();
          }
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.app}>
      <TitleBar />
      {nowPlayingOpen ? (
        <NowPlaying />
      ) : (
        <>
          <div className={styles.body}>
            <Sidebar />
            {viewMode === "artists" ? <ArtistView /> :
             viewMode === "albums" ? <AlbumView /> :
             viewMode === "settings" ? <SettingsView /> :
             <TrackList />}
          </div>
          <PlayerBar />
        </>
      )}
      <QueuePanel />
    </div>
  );
}

export default App;
