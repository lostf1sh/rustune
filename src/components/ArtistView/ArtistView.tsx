import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useState, useRef } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { TagEditor } from "../TagEditor/TagEditor";
import { commands, type ArtistInfo, type Track } from "../../lib/commands";
import styles from "./ArtistView.module.css";

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

const ARTIST_LIST_ROW_PX = 30;
const ARTIST_TRACK_ROW_PX = 36;

export function ArtistView() {
  const [artists, setArtists] = useState<ArtistInfo[]>([]);
  const [filter, setFilter] = useState("");
  const { playQueue, currentTrack, isPlaying } = usePlayerStore();
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const { selectedArtist, selectedArtistTracks, selectArtist, playlists, addTracksToPlaylist } =
    usePlaylistStore();
  const loadTracks = useLibraryStore((s) => s.loadTracks);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const artistListRef = useRef<HTMLDivElement>(null);
  const artistTrackTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commands.getArtists().then(setArtists);
  }, [libraryTracks]);

  useEffect(() => {
    if (selectedArtist) {
      selectArtist(selectedArtist);
    }
  }, [selectedArtist, selectArtist, libraryTracks]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const filtered = filter
    ? artists.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()))
    : artists;

  const artistListVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => artistListRef.current,
    estimateSize: () => ARTIST_LIST_ROW_PX,
    overscan: 16,
    getItemKey: (index) => filtered[index]?.name ?? index,
  });

  const artistTrackVirtualizer = useVirtualizer({
    count: selectedArtistTracks.length,
    getScrollElement: () => artistTrackTableRef.current,
    estimateSize: () => ARTIST_TRACK_ROW_PX,
    overscan: 12,
    getItemKey: (index) => selectedArtistTracks[index]?.id ?? index,
  });

  const handlePlay = async (index: number) => {
    const paths = selectedArtistTracks.map((t) => t.path);
    await playQueue(paths, index);
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id, trackPath: track.path });
  };

  return (
    <div className={styles.container}>
      {/* Left pane: artist list */}
      <div className={styles.listPane}>
        <div className={styles.listHeader}>
          <svg className={styles.searchIcon} width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={filterRef}
            type="text"
            className={styles.filterInput}
            placeholder="Filter artists..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className={styles.artistCount}>{filtered.length}</span>
        </div>
        <div className={styles.listScroll} ref={artistListRef}>
          {filtered.length === 0 ? (
            <p className={styles.emptyHint}>
              {filter ? "No artists match" : "No artists"}
            </p>
          ) : (
            <div
              className={styles.artistVirtualBody}
              style={{ height: `${artistListVirtualizer.getTotalSize()}px` }}
            >
              {artistListVirtualizer.getVirtualItems().map((virtualRow) => {
                const artist = filtered[virtualRow.index]!;
                return (
                  <div
                    key={artist.name}
                    className={styles.artistVirtualRowHost}
                    data-index={virtualRow.index}
                    ref={artistListVirtualizer.measureElement}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <button
                      className={`${styles.artistItem} ${selectedArtist === artist.name ? styles.selected : ""}`}
                      onClick={() => selectArtist(artist.name)}
                    >
                      <span className={styles.artistName}>{artist.name}</span>
                      <span className={styles.trackBadge}>{artist.trackCount}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right pane: tracks */}
      <div className={styles.trackPane}>
        {!selectedArtist ? (
          <div className={styles.placeholder}>
            <svg width="32" height="32" viewBox="0 0 15 15" fill="none" opacity="0.2">
              <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.5 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className={styles.placeholderText}>Select an artist</p>
          </div>
        ) : (
          <>
            <div className={styles.trackHeader}>
              <h2 className={styles.artistTitle}>{selectedArtist}</h2>
              <span className={styles.trackMeta}>
                {selectedArtistTracks.length} track{selectedArtistTracks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className={styles.tableWrap} ref={artistTrackTableRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thNum}>#</th>
                    <th>TITLE</th>
                    <th className={styles.thArtist}>ARTIST</th>
                    <th className={styles.thAlbum}>ALBUM</th>
                    <th className={styles.thDuration}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                        <path d="M6.5 3.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    </th>
                  </tr>
                </thead>
              </table>
              <div
                className={styles.trackVirtualBody}
                style={{ height: `${artistTrackVirtualizer.getTotalSize()}px` }}
              >
                {artistTrackVirtualizer.getVirtualItems().map((virtualRow) => {
                  const i = virtualRow.index;
                  const track = selectedArtistTracks[i]!;
                  const isCurrent = currentTrack === track.path;
                  return (
                    <div
                      key={track.id}
                      className={styles.trackVirtualRowHost}
                      data-index={virtualRow.index}
                      ref={artistTrackVirtualizer.measureElement}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <table className={styles.table} style={{ tableLayout: "fixed", width: "100%" }}>
                        <tbody>
                          <tr
                            className={`${styles.row} ${isCurrent ? styles.playing : ""}`}
                            onDoubleClick={() => handlePlay(i)}
                            onContextMenu={(e) => handleContextMenu(e, track)}
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
                            <td className={styles.cellArtist}>{track.artist ?? "Unknown Artist"}</td>
                            <td className={styles.cellAlbum}>{track.album ?? "—"}</td>
                            <td className={styles.cellDuration}>{formatDuration(track.durationMs)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
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
                  onClick={() => {
                    addTracksToPlaylist(pl.id, [contextMenu.trackId]);
                    setContextMenu(null);
                  }}
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
