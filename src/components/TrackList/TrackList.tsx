import { useCallback, useRef } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
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

export function TrackList() {
  const { filteredTracks, searchQuery, setSearchQuery, sortField, sortDir, setSort } =
    useLibraryStore();
  const { playQueue, currentTrack, isPlaying } = usePlayerStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    const paths = filteredTracks.map((t) => t.path);
    await playQueue(paths, index);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <span className={styles.sortIcon}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (filteredTracks.length === 0 && !searchQuery) {
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
          <p className={styles.emptyTitle}>No tracks yet</p>
          <p className={styles.emptyHint}>
            Add a folder from the sidebar to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.searchWrap}>
          <svg
            className={styles.searchIcon}
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M9.5 9.5L13 13"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
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
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thNum}>#</th>
              <th
                className={styles.thTitle}
                onClick={() => setSort("title")}
              >
                TITLE <SortIcon field="title" />
              </th>
              <th
                className={styles.thArtist}
                onClick={() => setSort("artist")}
              >
                ARTIST <SortIcon field="artist" />
              </th>
              <th
                className={styles.thAlbum}
                onClick={() => setSort("album")}
              >
                ALBUM <SortIcon field="album" />
              </th>
              <th
                className={styles.thDuration}
                onClick={() => setSort("duration")}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M6.5 3.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                <SortIcon field="duration" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTracks.map((track, i) => {
              const isCurrent = currentTrack === track.path;
              return (
                <tr
                  key={track.id}
                  className={`${styles.row} ${isCurrent ? styles.playing : ""}`}
                  onDoubleClick={() => handlePlay(i)}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
