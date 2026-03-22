import { useCallback, useEffect, useRef, useState } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { TagEditor } from "../TagEditor/TagEditor";
import type { Track } from "../../lib/commands";
import styles from "./TrackList.module.css";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function EqIndicator() {
  return (
    <div className={styles.eqBars}>
      <span className={styles.eqBar} style={{ animationDelay: "0ms" }} />
      <span className={styles.eqBar} style={{ animationDelay: "180ms" }} />
      <span className={styles.eqBar} style={{ animationDelay: "90ms" }} />
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  trackId: number;
  trackPath: string;
}

export function TrackList() {
  const { filteredTracks, searchQuery, setSearchQuery, sortField, sortDir, setSort } =
    useLibraryStore();
  const { playQueue, currentTrack, isPlaying } = usePlayerStore();
  const {
    viewMode,
    activePlaylistId,
    activePlaylistTracks,
    playlists,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
  } = usePlaylistStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const loadTracks = useLibraryStore((s) => s.loadTracks);

  const isPlaylistView = viewMode === "playlist";
  const displayTracks: Track[] = isPlaylistView ? activePlaylistTracks : filteredTracks;
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 150);
    },
    [setSearchQuery]
  );

  const handlePlay = async (index: number) => {
    const paths = displayTracks.map((t) => t.path);
    await playQueue(paths, index);
  };

  const handleContextMenu = (e: React.MouseEvent, trackId: number, trackPath: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId, trackPath });
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (contextMenu) {
      await addTracksToPlaylist(playlistId, [contextMenu.trackId]);
      setContextMenu(null);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <span className={styles.sortIcon}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (displayTracks.length === 0 && !searchQuery) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M28 8v20a4 4 0 11-4-4h4V12l-12 3v15a4 4 0 11-4-4h4V11l16-4v1z"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className={styles.emptyTitle}>
            {isPlaylistView ? "Playlist is empty" : "No tracks yet"}
          </p>
          <p className={styles.emptyHint}>
            {isPlaylistView
              ? "Right-click tracks in Library to add them"
              : "Add a folder from the sidebar to get started"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {isPlaylistView && activePlaylist ? (
          <div className={styles.playlistHeader}>
            <h2 className={styles.playlistTitle}>{activePlaylist.name}</h2>
            <span className={styles.playlistMeta}>
              {activePlaylist.trackCount} track{activePlaylist.trackCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search tracks..."
              defaultValue={searchQuery}
              onChange={handleSearch}
            />
            {searchQuery && (
              <span className={styles.resultCount}>
                {filteredTracks.length} result{filteredTracks.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thNum}>#</th>
              <th className={styles.thTitle} onClick={() => !isPlaylistView && setSort("title")}>
                TITLE {!isPlaylistView && <SortIcon field="title" />}
              </th>
              <th className={styles.thArtist} onClick={() => !isPlaylistView && setSort("artist")}>
                ARTIST {!isPlaylistView && <SortIcon field="artist" />}
              </th>
              <th className={styles.thAlbum} onClick={() => !isPlaylistView && setSort("album")}>
                ALBUM {!isPlaylistView && <SortIcon field="album" />}
              </th>
              <th className={styles.thDuration} onClick={() => !isPlaylistView && setSort("duration")}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M6.5 3.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                {!isPlaylistView && <SortIcon field="duration" />}
              </th>
              {isPlaylistView && <th className={styles.thAction} />}
            </tr>
          </thead>
          <tbody>
            {displayTracks.map((track, i) => {
              const isCurrent = currentTrack === track.path;
              return (
                <tr
                  key={`${track.id}-${i}`}
                  className={`${styles.row} ${isCurrent ? styles.playing : ""}`}
                  onDoubleClick={() => handlePlay(i)}
                  onContextMenu={(e) => handleContextMenu(e, track.id, track.path)}
                >
                  <td className={styles.cellNum}>
                    {isCurrent && isPlaying ? (
                      <EqIndicator />
                    ) : (
                      <span className={isCurrent ? styles.numPlaying : styles.num}>
                        {i + 1}
                      </span>
                    )}
                  </td>
                  <td className={styles.cellTitle}>
                    <span className={isCurrent ? styles.titlePlaying : ""}>
                      {track.title ?? "Unknown"}
                    </span>
                  </td>
                  <td className={styles.cellArtist}>
                    {track.artist ?? "Unknown Artist"}
                  </td>
                  <td className={styles.cellAlbum}>
                    {track.album ?? "—"}
                  </td>
                  <td className={styles.cellDuration}>
                    {formatDuration(track.durationMs)}
                  </td>
                  {isPlaylistView && activePlaylistId && (
                    <td className={styles.cellAction}>
                      <button
                        className={styles.removeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackFromPlaylist(activePlaylistId, track.id);
                        }}
                        title="Remove from playlist"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                          <path d="M2 2l6 6M8 2l-6 6" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {playlists.length > 0 && (
            <>
              <div className={styles.contextLabel}>Add to playlist</div>
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  className={styles.contextItem}
                  onClick={() => handleAddToPlaylist(pl.id)}
                >
                  {pl.name}
                </button>
              ))}
              <div className={styles.contextDivider} />
            </>
          )}
          <button
            className={styles.contextItem}
            onClick={() => {
              setEditingPath(contextMenu.trackPath);
              setContextMenu(null);
            }}
          >
            Edit Tags
          </button>
        </div>
      )}

      {/* Tag Editor modal */}
      {editingPath && (
        <TagEditor
          path={editingPath}
          onClose={() => setEditingPath(null)}
          onSaved={loadTracks}
        />
      )}
    </div>
  );
}
