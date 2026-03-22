import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
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
    togglePlayPause,
    stop,
    seek,
    setVolume,
  } = usePlayerStore();

  const tracks = useLibraryStore((s) => s.tracks);
  const trackMeta = tracks.find((t) => t.path === currentTrack);

  const displayTitle = trackMeta?.title ?? extractFileName(currentTrack);
  const displayArtist = trackMeta?.artist ?? null;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const progress = durationSecs > 0 ? (positionSecs / durationSecs) * 100 : 0;

  return (
    <div className={styles.playerBar}>
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

      <div className={styles.center}>
        <div className={styles.controls}>
          <button className={styles.controlBtn} onClick={stop} title="Stop">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="1" />
            </svg>
          </button>

          <button
            className={`${styles.controlBtn} ${styles.playBtn}`}
            onClick={togglePlayPause}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="3.5" height="12" rx="0.8" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="0.8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
              </svg>
            )}
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
    </div>
  );
}

function extractFileName(path: string | null): string {
  if (!path) return "";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1].replace(/\.[^.]+$/, "");
}
