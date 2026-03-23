import { useCallback, useEffect, useRef, useState } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { TagEditor } from "../TagEditor/TagEditor";
import { useSelectionStore } from "../../stores/selectionStore";
import { commands, type Track } from "../../lib/commands";
import styles from "./TrackList.module.css";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalDuration(tracks: Track[]): string {
  const totalMs = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
  const mins = Math.floor(totalMs / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs} hr ${rem} min`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
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

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) return null;
  return <span className={styles.sortIcon}>{dir === "asc" ? "↑" : "↓"}</span>;
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
    favoriteTracks,
    recentTracks,
    playlists,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    refreshActiveView,
    updatePlaylistMeta,
    togglePlaylistPin,
    playlistSearchQuery,
    setPlaylistSearchQuery,
    removeTracksFromPlaylist,
  } = usePlaylistStore();

  const selection = useSelectionStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const loadTracks = useLibraryStore((s) => s.loadTracks);

  // Playlist header editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);

  const isPlaylistView = viewMode === "playlist";
  const showSearch = viewMode === "library";
  const canSort = viewMode === "library";

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  // Playlist search filtering
  const filteredPlaylistTracks = isPlaylistView && playlistSearchQuery
    ? activePlaylistTracks.filter((t) => {
        const q = playlistSearchQuery.toLowerCase();
        return (
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q)
        );
      })
    : activePlaylistTracks;

  const displayTracks: Track[] =
    viewMode === "playlist" ? filteredPlaylistTracks :
    viewMode === "favorites" ? favoriteTracks :
    viewMode === "recentPlays" ? recentTracks :
    filteredTracks;

  const viewTitle =
    viewMode === "favorites" ? "Favorites" :
    viewMode === "recentPlays" ? "Recently Played" :
    null;

  // Reset playlist search when leaving playlist view
  useEffect(() => {
    if (!isPlaylistView) {
      setPlaylistSearchQuery("");
    }
  }, [isPlaylistView, setPlaylistSearchQuery]);

  // Clear selection when playlist search changes
  useEffect(() => {
    selection.clearSelection();
  }, [playlistSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus title/desc inputs
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingDesc && descInputRef.current) {
      descInputRef.current.focus();
    }
  }, [editingDesc]);

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

  const handlePlaylistSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlaylistSearchQuery(e.target.value);
    },
    [setPlaylistSearchQuery]
  );

  const handlePlay = async (index: number) => {
    if (isPlaylistView && playlistSearchQuery) {
      // Map filtered index to unfiltered index
      const track = displayTracks[index];
      const unfilteredIndex = activePlaylistTracks.findIndex((t) => t.id === track.id);
      const paths = activePlaylistTracks.map((t) => t.path);
      await playQueue(paths, unfilteredIndex >= 0 ? unfilteredIndex : index);
    } else {
      const paths = displayTracks.map((t) => t.path);
      await playQueue(paths, index);
    }
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

  const handleRowClick = (e: React.MouseEvent, track: Track, index: number) => {
    if (!isPlaylistView) return;
    if (e.shiftKey) {
      e.preventDefault();
      selection.rangeSelect(index, displayTracks.map((t) => t.id));
    } else if (e.ctrlKey || e.metaKey) {
      selection.toggleSelect(track.id, index);
    } else {
      selection.select(track.id, index);
    }
  };

  const handleBulkRemove = async () => {
    if (!activePlaylistId) return;
    const ids = selection.getSelectedIds();
    if (ids.length === 0) return;
    await removeTracksFromPlaylist(activePlaylistId, ids);
    selection.clearSelection();
  };

  const handleToggleFavorite = async (e: React.MouseEvent, trackId: number) => {
    e.stopPropagation();
    await commands.toggleFavorite(trackId);
    await loadTracks();
    await refreshActiveView();
  };

  const handleSaveTitle = async () => {
    if (activePlaylist && titleDraft.trim() && titleDraft.trim() !== activePlaylist.name) {
      await updatePlaylistMeta(
        activePlaylist.id,
        titleDraft.trim(),
        activePlaylist.description,
        activePlaylist.pinned,
        activePlaylist.coverTrackPath
      );
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    if (activePlaylist && descDraft !== activePlaylist.description) {
      await updatePlaylistMeta(
        activePlaylist.id,
        activePlaylist.name,
        descDraft,
        activePlaylist.pinned,
        activePlaylist.coverTrackPath
      );
    }
    setEditingDesc(false);
  };

  if (displayTracks.length === 0 && searchQuery && showSearch) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search tracks..."
              defaultValue={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No results</p>
          <p className={styles.emptyHint}>No tracks match &ldquo;{searchQuery}&rdquo;</p>
        </div>
      </div>
    );
  }

  if (displayTracks.length === 0 && !(isPlaylistView && playlistSearchQuery)) {
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
            {viewMode === "favorites" ? "No favorites yet" :
             viewMode === "recentPlays" ? "No recent plays" :
             isPlaylistView ? "Playlist is empty" :
             "No tracks yet"}
          </p>
          <p className={styles.emptyHint}>
            {viewMode === "favorites" ? "Click the heart icon on any track" :
             viewMode === "recentPlays" ? "Start playing some music" :
             isPlaylistView ? "Right-click tracks in Library to add them" :
             "Add a folder from the sidebar to get started"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {isPlaylistView && activePlaylist ? (
          <div className={styles.playlistHeaderWrap}>
            <div className={styles.playlistHeader}>
              <div className={styles.playlistTitleRow}>
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className={styles.titleInput}
                  />
                ) : (
                  <h2
                    className={styles.playlistTitle}
                    onClick={() => {
                      setTitleDraft(activePlaylist.name);
                      setEditingTitle(true);
                    }}
                    title="Click to rename"
                  >
                    {activePlaylist.name}
                  </h2>
                )}
                <button
                  className={`${styles.headerPinBtn} ${activePlaylist.pinned ? styles.headerPinActive : ""}`}
                  onClick={() => togglePlaylistPin(activePlaylist.id)}
                  title={activePlaylist.pinned ? "Unpin" : "Pin playlist"}
                >
                  <svg width="11" height="11" viewBox="0 0 10 10" fill={activePlaylist.pinned ? "currentColor" : "none"}>
                    <path d="M6.5 1L9 3.5 6.5 6H5L3.5 8.5 1.5 6.5 4 5V3.5L6.5 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {editingDesc ? (
                <input
                  ref={descInputRef}
                  type="text"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={handleSaveDesc}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDesc();
                    if (e.key === "Escape") setEditingDesc(false);
                  }}
                  className={styles.descInput}
                  placeholder="Add a description..."
                />
              ) : (
                <p
                  className={`${styles.playlistDesc} ${!activePlaylist.description ? styles.descPlaceholder : ""}`}
                  onClick={() => {
                    setDescDraft(activePlaylist.description);
                    setEditingDesc(true);
                  }}
                >
                  {activePlaylist.description || "Add a description..."}
                </p>
              )}

              <span className={styles.playlistMeta}>
                {activePlaylist.trackCount} track{activePlaylist.trackCount !== 1 ? "s" : ""}
                {activePlaylistTracks.length > 0 && ` · ${formatTotalDuration(activePlaylistTracks)}`}
                {activePlaylist.updatedAt && ` · Updated ${timeAgo(activePlaylist.updatedAt)}`}
              </span>
            </div>

            {/* Playlist search */}
            <div className={styles.playlistSearchWrap}>
              <svg className={styles.searchIcon} width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Filter playlist..."
                value={playlistSearchQuery}
                onChange={handlePlaylistSearch}
              />
              {playlistSearchQuery && (
                <span className={styles.resultCount}>
                  {filteredPlaylistTracks.length} / {activePlaylistTracks.length}
                </span>
              )}
            </div>
          </div>
        ) : viewTitle ? (
          <div className={styles.playlistHeader}>
            <h2 className={styles.playlistTitle}>{viewTitle}</h2>
            <span className={styles.playlistMeta}>
              {displayTracks.length} track{displayTracks.length !== 1 ? "s" : ""}
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

      {/* Selection toolbar */}
      {isPlaylistView && selection.selectedCount() > 0 && (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>{selection.selectedCount()}</span>
          <span className={styles.selectionLabel}>selected</span>
          <div className={styles.selectionActions}>
            <button className={styles.selectionBtn} onClick={handleBulkRemove}>
              Remove
            </button>
            <button
              className={styles.selectionBtn}
              onClick={() => selection.selectAll(displayTracks.map((t) => t.id))}
            >
              Select All
            </button>
            <button className={styles.selectionBtn} onClick={selection.clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thNum}>#</th>
              <th className={styles.thTitle} onClick={() => canSort && setSort("title")}>
                TITLE {canSort && <SortIcon active={sortField === "title"} dir={sortDir} />}
              </th>
              <th className={styles.thArtist} onClick={() => canSort && setSort("artist")}>
                ARTIST {canSort && <SortIcon active={sortField === "artist"} dir={sortDir} />}
              </th>
              <th className={styles.thAlbum} onClick={() => canSort && setSort("album")}>
                ALBUM {canSort && <SortIcon active={sortField === "album"} dir={sortDir} />}
              </th>
              <th className={styles.thFav} />
              <th className={styles.thDuration} onClick={() => canSort && setSort("duration")}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M6.5 3.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                {canSort && <SortIcon active={sortField === "duration"} dir={sortDir} />}
              </th>
              {isPlaylistView && <th className={styles.thAction} />}
            </tr>
          </thead>
          <tbody>
              {displayTracks.map((track, i) => {
                const isCurrent = currentTrack === track.path;
                const isFav = track.favorite;
              return (
                <tr
                  key={`${track.id}-${i}`}
                  className={`${styles.row} ${isCurrent ? styles.playing : ""} ${isPlaylistView && selection.isSelected(track.id) ? styles.selected : ""}`}
                  onClick={(e) => handleRowClick(e, track, i)}
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
                  <td className={styles.cellFav}>
                    <button
                      className={`${styles.favBtn} ${isFav ? styles.favActive : ""}`}
                      onClick={(e) => handleToggleFavorite(e, track.id)}
                      title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <svg width="12" height="12" viewBox="0 0 15 15" fill={isFav ? "currentColor" : "none"}>
                        <path d="M7.5 13l-5.2-5.4A3.2 3.2 0 017.5 3.1a3.2 3.2 0 015.2 4.5L7.5 13z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                      </svg>
                    </button>
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
          <button
            className={styles.contextItem}
            onClick={() => {
              commands.insertNextInQueue(contextMenu.trackPath);
              setContextMenu(null);
            }}
          >
            Play Next
          </button>
          <button
            className={styles.contextItem}
            onClick={() => {
              commands.addToQueue(contextMenu.trackPath);
              setContextMenu(null);
            }}
          >
            Add to Queue
          </button>
          <div className={styles.contextDivider} />
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
