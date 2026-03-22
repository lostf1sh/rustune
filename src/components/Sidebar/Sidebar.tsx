import { useState, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const { trackCount, isScanning, scanFolder } = useLibraryStore();
  const [scanProgress, setScanProgress] = useState(0);
  const {
    playlists,
    viewMode,
    activePlaylistId,
    viewPlaylist,
    viewLibrary,
    viewArtists,
    viewAlbums,
    createPlaylist,
    deletePlaylist,
  } = usePlaylistStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    const unlistenProgress = listen<number>("scan-progress", (e) => {
      setScanProgress(e.payload);
    });
    const unlistenComplete = listen<number>("scan-complete", () => {
      setScanProgress(0);
    });
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, []);

  const handleAddFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Folder",
    });
    if (selected) {
      setScanProgress(0);
      await scanFolder(selected);
    }
  };

  const handleCreatePlaylist = async () => {
    const name = newName.trim();
    if (name) {
      await createPlaylist(name);
    }
    setNewName("");
    setIsCreating(false);
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreatePlaylist();
    } else if (e.key === "Escape") {
      setNewName("");
      setIsCreating(false);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>R</span>
        <span className={styles.brandName}>rustune</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>BROWSE</span>
          <button
            className={`${styles.navItem} ${viewMode === "library" ? styles.active : ""}`}
            onClick={viewLibrary}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13.5 13.5H1.5V1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M4 10V6M7 10V4M10 10V7.5M13 10V2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Library
          </button>
          <button
            className={`${styles.navItem} ${viewMode === "artists" ? styles.active : ""}`}
            onClick={viewArtists}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.5 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Artists
          </button>
          <button
            className={`${styles.navItem} ${viewMode === "albums" ? styles.active : ""}`}
            onClick={viewAlbums}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
            </svg>
            Albums
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>PLAYLISTS</span>
            <button
              className={styles.sectionAddBtn}
              onClick={() => setIsCreating(true)}
              title="New playlist"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={`${styles.playlistItem} ${activePlaylistId === pl.id ? styles.active : ""}`}
              onClick={() => viewPlaylist(pl.id)}
            >
              <svg className={styles.playlistIcon} width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 3h7M2 6h5M2 9h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M10 4.5v5a1.5 1.5 0 11-1.5-1.5H10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={styles.playlistName}>{pl.name}</span>
              <span className={styles.playlistCount}>{pl.trackCount}</span>
              <button
                className={styles.playlistDeleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  deletePlaylist(pl.id);
                }}
                title="Delete playlist"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
                </svg>
              </button>
            </div>
          ))}

          {isCreating && (
            <div className={styles.createInput}>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                onBlur={handleCreatePlaylist}
                placeholder="Playlist name..."
                className={styles.inlineInput}
              />
            </div>
          )}

          {playlists.length === 0 && !isCreating && (
            <p className={styles.emptyHint}>No playlists yet</p>
          )}
        </div>
      </nav>

      <div className={styles.bottom}>
        <button
          className={styles.addBtn}
          onClick={handleAddFolder}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <span className={styles.spinner} />
              {scanProgress > 0 ? `${scanProgress} found...` : "Scanning..."}
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Add Folder
            </>
          )}
        </button>
        {trackCount > 0 && (
          <span className={styles.trackCount}>
            {trackCount.toLocaleString()} tracks
          </span>
        )}
      </div>
    </aside>
  );
}
