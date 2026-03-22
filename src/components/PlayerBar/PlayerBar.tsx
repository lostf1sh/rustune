import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { commands, type AlbumArt } from "../../lib/commands";
import styles from "./PlayerBar.module.css";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    isPlaying,
    currentTrack,
    positionSecs,
    durationSecs,
    volume,
    shuffle,
    repeat,
    queue,
    queueOpen,
    togglePlayPause,
    seek,
    setVolume,
    nextTrack,
    prevTrack,
    toggleShuffle,
    cycleRepeat,
    toggleQueue,
    toggleNowPlaying,
  } = usePlayerStore();

  const tracks = useLibraryStore((s) => s.tracks);
  const trackMeta = tracks.find((t) => t.path === currentTrack);

  const displayTitle = trackMeta?.title ?? extractFileName(currentTrack);
  const displayArtist = trackMeta?.artist ?? null;

  const [albumArt, setAlbumArt] = useState<AlbumArt | null>(null);
  const lastTrackRef = useRef<string | null>(null);
  const [albumArtPath, setAlbumArtPath] = useState<string | null>(null);
  const [loadedArtPath, setLoadedArtPath] = useState<string | null>(null);

  useEffect(() => {
    if (currentTrack === lastTrackRef.current) return;
    lastTrackRef.current = currentTrack;

    if (!currentTrack) {
      Promise.resolve().then(() => {
        setAlbumArt(null);
        setAlbumArtPath(null);
        setLoadedArtPath(null);
      });
      return;
    }

    commands.getAlbumArt(currentTrack).then((art) => {
      if (lastTrackRef.current === currentTrack) {
        setAlbumArt(art);
        setAlbumArtPath(currentTrack);
        setLoadedArtPath(null);
      }
    });
  }, [currentTrack]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const progress = durationSecs > 0 ? (positionSecs / durationSecs) * 100 : 0;
  const visibleAlbumArt = albumArtPath === currentTrack ? albumArt : null;
  const artLoaded = loadedArtPath === currentTrack;

  return (
    <div className={styles.playerBar}>
      <div className={styles.leftSection}>
        <div
          className={`${styles.artWrap} ${currentTrack ? styles.artClickable : ""}`}
          onClick={currentTrack ? toggleNowPlaying : undefined}
          title={currentTrack ? "Now Playing" : undefined}
        >
          {visibleAlbumArt ? (
            <img
              className={`${styles.art} ${artLoaded ? styles.artVisible : ""}`}
              key={currentTrack ?? "empty"}
              src={`data:${visibleAlbumArt.mimeType};base64,${visibleAlbumArt.data}`}
              alt=""
              onLoad={() => setLoadedArtPath(currentTrack)}
            />
          ) : (
            <div className={styles.artPlaceholder}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M13 3v10a2.5 2.5 0 11-2.5-2.5H13V5.5L7 7v7a2.5 2.5 0 11-2.5-2.5H7V4l10-2.5v1z"
                  stroke="var(--text-muted)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                />
              </svg>
            </div>
          )}
        </div>
        <div className={styles.trackInfo}>
          {currentTrack ? (
            <>
              <span className={styles.trackTitle}>{displayTitle}</span>
              {displayArtist && (
                <span className={styles.trackArtist}>{displayArtist}</span>
              )}
            </>
          ) : (
            <span className={styles.noTrack}>Not playing</span>
          )}
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.controls}>
          {/* Shuffle */}
          <button
            className={`${styles.modeBtn} ${shuffle ? styles.modeActive : ""}`}
            onClick={toggleShuffle}
            title={shuffle ? "Shuffle on" : "Shuffle off"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M1 10h2l3-3-3-3H1" />
              <path d="M1 4h2l3 3 3-3h2" />
              <path d="M11 3v2h2" />
              <path d="M11 9v2h2" />
              <path d="M8 10h3" />
            </svg>
            {shuffle && <span className={styles.modeDot} />}
          </button>

          {/* Previous */}
          <button
            className={styles.controlBtn}
            onClick={prevTrack}
            title="Previous"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1.5" y="3" width="1.8" height="8" rx="0.4" />
              <path d="M12 3.2L5.5 7l6.5 3.8V3.2z" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={togglePlayPause}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3.5" y="2.5" width="3.2" height="11" rx="0.8" />
                <rect x="9.3" y="2.5" width="3.2" height="11" rx="0.8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.5 2.5l9 5.5-9 5.5V2.5z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            className={styles.controlBtn}
            onClick={nextTrack}
            title="Next"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2 3.2L8.5 7 2 10.8V3.2z" />
              <rect x="10.7" y="3" width="1.8" height="8" rx="0.4" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            className={`${styles.modeBtn} ${repeat !== "off" ? styles.modeActive : ""}`}
            onClick={cycleRepeat}
            title={
              repeat === "off"
                ? "Repeat off"
                : repeat === "all"
                  ? "Repeat all"
                  : "Repeat one"
            }
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 8.5V6a2 2 0 012-2h7" />
              <path d="M12.5 5.5V8a2 2 0 01-2 2h-7" />
              <path d="M9 2.5l1.5 1.5L9 5.5" />
              <path d="M5 8.5L3.5 10 5 11.5" />
            </svg>
            {repeat === "one" && <span className={styles.repeatBadge}>1</span>}
            {repeat !== "off" && <span className={styles.modeDot} />}
          </button>
        </div>

        <div className={styles.seekBar}>
          <span className={styles.time}>{formatTime(positionSecs)}</span>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={durationSecs || 1}
            step={0.1}
            value={positionSecs}
            onChange={handleSeek}
            style={{ "--progress": `${progress}%` } as React.CSSProperties}
          />
          <span className={styles.time}>{formatTime(durationSecs)}</span>
        </div>
      </div>

      <div className={styles.rightControls}>
        <div className={styles.volumeControl}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            className={styles.volumeIcon}
          >
            {volume === 0 ? (
              <path d="M7 2.5L4 5H1.5v4H4l3 2.5V2.5z" />
            ) : (
              <>
                <path d="M7 2.5L4 5H1.5v4H4l3 2.5V2.5z" />
                <path
                  d="M9 5.5c.6.5.6 3 0 3.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  fill="none"
                  strokeLinecap="round"
                />
                {volume > 0.5 && (
                  <path
                    d="M10.2 4c1.2 1 1.2 5 0 6"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
              </>
            )}
          </svg>
          <input
            type="range"
            className={styles.volumeSlider}
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            style={{ "--progress": `${volume * 100}%` } as React.CSSProperties}
          />
        </div>

        <button
          className={`${styles.queueBtn} ${queueOpen ? styles.queueBtnActive : ""}`}
          onClick={toggleQueue}
          title="Queue"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M2 4h9M2 8h7M2 12h5" />
            <path d="M12 7v6M9 10h6" />
          </svg>
          {queue.length > 0 && !queueOpen && (
            <span className={styles.queueBadge}>{queue.length}</span>
          )}
        </button>
      </div>
    </div>
  );
}

function extractFileName(path: string | null): string {
  if (!path) return "";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1].replace(/\.[^.]+$/, "");
}
