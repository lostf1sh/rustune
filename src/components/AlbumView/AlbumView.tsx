import { useEffect, useState, useRef } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { TagEditor } from "../TagEditor/TagEditor";
import { commands, type AlbumInfo, type AlbumArt, type Track } from "../../lib/commands";
import styles from "./AlbumView.module.css";

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

function EqIndicator() {
  return (
    <div className={styles.eqBars}>
      <span className={styles.eqBar} style={{ animationDelay: "0ms" }} />
      <span className={styles.eqBar} style={{ animationDelay: "180ms" }} />
      <span className={styles.eqBar} style={{ animationDelay: "90ms" }} />
    </div>
  );
}

function PlaceholderArt({ size }: { size: number }) {
  return (
    <div className={styles.placeholderArt} style={{ width: size, height: size }}>
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
      </svg>
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  trackId: number;
  trackPath: string;
}

export function AlbumView() {
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [artCache, setArtCache] = useState<Map<string, AlbumArt | null>>(new Map());
  const [filter, setFilter] = useState("");
  const { playQueue, currentTrack, isPlaying } = usePlayerStore();
  const {
    selectedAlbum,
    selectedAlbumTracks,
    selectAlbum,
    clearAlbumSelection,
    playlists,
    addTracksToPlaylist,
  } = usePlaylistStore();
  const loadTracks = useLibraryStore((s) => s.loadTracks);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const artLoadRef = useRef(new Set<string>());

  useEffect(() => {
    commands.getAlbums().then(setAlbums);
  }, []);

  // Lazy load art for visible albums
  useEffect(() => {
    for (const album of albums) {
      if (!album.artTrackPath) continue;
      const key = `${album.album}||${album.albumArtist ?? ""}`;
      if (artCache.has(key) || artLoadRef.current.has(key)) continue;
      artLoadRef.current.add(key);
      commands.getAlbumArt(album.artTrackPath).then((art) => {
        setArtCache((prev) => new Map(prev).set(key, art));
      });
    }
  }, [albums, artCache]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const filtered = filter
    ? albums.filter(
        (a) =>
          a.album.toLowerCase().includes(filter.toLowerCase()) ||
          (a.albumArtist?.toLowerCase().includes(filter.toLowerCase()) ?? false)
      )
    : albums;

  const handlePlay = async (index: number) => {
    const paths = selectedAlbumTracks.map((t) => t.path);
    await playQueue(paths, index);
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id, trackPath: track.path });
  };

  const getArt = (album: AlbumInfo) => {
    const key = `${album.album}||${album.albumArtist ?? ""}`;
    return artCache.get(key) ?? null;
  };

  // ── Album detail view ──
  if (selectedAlbum) {
    const detailArt = albums.find(
      (a) => a.album === selectedAlbum.album && a.albumArtist === selectedAlbum.albumArtist
    );
    const art = detailArt ? getArt(detailArt) : null;

    return (
      <div className={styles.container}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={clearAlbumSelection}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Albums
          </button>
        </div>
        <div className={styles.albumInfo}>
          {art ? (
            <img
              src={`data:${art.mimeType};base64,${art.data}`}
              className={styles.detailArt}
              draggable={false}
            />
          ) : (
            <PlaceholderArt size={180} />
          )}
          <div className={styles.albumMeta}>
            <h1 className={styles.albumTitle}>{selectedAlbum.album}</h1>
            <p className={styles.albumArtist}>
              {selectedAlbum.albumArtist ?? selectedAlbumTracks[0]?.artist ?? "Unknown Artist"}
            </p>
            <div className={styles.albumStats}>
              {detailArt?.year && <span>{detailArt.year}</span>}
              <span>{selectedAlbumTracks.length} track{selectedAlbumTracks.length !== 1 ? "s" : ""}</span>
              <span>{formatTotalDuration(selectedAlbumTracks)}</span>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thNum}>#</th>
                <th>TITLE</th>
                <th className={styles.thArtist}>ARTIST</th>
                <th className={styles.thDuration}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M6.5 3.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedAlbumTracks.map((track, i) => {
                const isCurrent = currentTrack === track.path;
                return (
                  <tr
                    key={`${track.id}-${i}`}
                    className={`${styles.row} ${isCurrent ? styles.playing : ""}`}
                    onDoubleClick={() => handlePlay(i)}
                    onContextMenu={(e) => handleContextMenu(e, track)}
                  >
                    <td className={styles.cellNum}>
                      {isCurrent && isPlaying ? (
                        <EqIndicator />
                      ) : (
                        <span className={isCurrent ? styles.numPlaying : styles.num}>
                          {track.trackNumber ?? i + 1}
                        </span>
                      )}
                    </td>
                    <td className={styles.cellTitle}>
                      <span className={isCurrent ? styles.titlePlaying : ""}>
                        {track.title ?? "Unknown"}
                      </span>
                    </td>
                    <td className={styles.cellArtist}>{track.artist ?? "Unknown Artist"}</td>
                    <td className={styles.cellDuration}>{formatDuration(track.durationMs)}</td>
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

  // ── Grid view ──
  return (
    <div className={styles.container}>
      <div className={styles.gridHeader}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search albums..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className={styles.albumCount}>{filtered.length} album{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className={styles.gridScroll}>
        <div className={styles.grid}>
          {filtered.map((album) => {
            const art = getArt(album);
            return (
              <button
                key={`${album.album}||${album.albumArtist ?? ""}`}
                className={styles.card}
                onClick={() => selectAlbum(album.album, album.albumArtist)}
              >
                <div className={styles.cardArtWrap}>
                  {art ? (
                    <img
                      src={`data:${art.mimeType};base64,${art.data}`}
                      className={styles.cardArt}
                      draggable={false}
                    />
                  ) : (
                    <PlaceholderArt size={150} />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardTitle}>{album.album}</span>
                  <span className={styles.cardArtist}>
                    {album.albumArtist ?? "Various Artists"}
                    {album.year ? ` · ${album.year}` : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {filter ? "No albums match" : "No albums"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
