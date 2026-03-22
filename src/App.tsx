import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PlayerBar } from "./components/PlayerBar/PlayerBar";
import { QueuePanel } from "./components/QueuePanel/QueuePanel";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TrackList } from "./components/TrackList/TrackList";
import { NowPlaying } from "./components/NowPlaying/NowPlaying";
import { usePlayerStore } from "./stores/playerStore";
import { useLibraryStore } from "./stores/libraryStore";
import { usePlaylistStore } from "./stores/playlistStore";
import type { PlaybackState } from "./lib/commands";
import styles from "./App.module.css";

function App() {
  const updateFromBackend = usePlayerStore((s) => s.updateFromBackend);
  const nowPlayingOpen = usePlayerStore((s) => s.nowPlayingOpen);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);

  useEffect(() => {
    loadTracks();
    loadPlaylists();
  }, [loadTracks, loadPlaylists]);

  // Playback state listener + window title update
  useEffect(() => {
    const unlisten = listen<PlaybackState>("playback-state", (event) => {
      updateFromBackend(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateFromBackend]);

  // Update window title with current track
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const tracks = useLibraryStore((s) => s.tracks);

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
      {nowPlayingOpen ? (
        <NowPlaying />
      ) : (
        <>
          <div className={styles.body}>
            <Sidebar />
            <TrackList />
          </div>
          <PlayerBar />
        </>
      )}
      <QueuePanel />
    </div>
  );
}

export default App;
