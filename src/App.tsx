import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { PlayerBar } from "./components/PlayerBar/PlayerBar";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TrackList } from "./components/TrackList/TrackList";
import { usePlayerStore } from "./stores/playerStore";
import { useLibraryStore } from "./stores/libraryStore";
import type { PlaybackState } from "./lib/commands";
import styles from "./App.module.css";

function App() {
  const updateFromBackend = usePlayerStore((s) => s.updateFromBackend);
  const loadTracks = useLibraryStore((s) => s.loadTracks);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

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
      <div className={styles.body}>
        <Sidebar />
        <TrackList />
      </div>
      <PlayerBar />
    </div>
  );
}

export default App;
