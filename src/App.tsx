import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
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

  useEffect(() => {
    const unlisten = listen<PlaybackState>("playback-state", (event) => {
      updateFromBackend(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateFromBackend]);

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
