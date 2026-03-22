import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { commands, type AlbumArt, type LyricsResult } from "../../lib/commands";
import styles from "./NowPlaying.module.css";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Isolated Lyrics Panel (memo'd, doesn't re-render on positionSecs) ──

interface LyricsPanelProps {
  lyrics: LyricsResult;
  onSeek: (timeMs: number) => void;
}

const LyricsPanel = memo(function LyricsPanel({ lyrics, onSeek }: LyricsPanelProps) {
  const positionSecs = usePlayerStore((s) => s.positionSecs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const animFrameRef = useRef<number>(0);
  const prevLineRef = useRef(-1);

  const hasSynced = !!lyrics.synced;

  // Find current line index
  const currentLineIndex = useMemo(() => {
    if (!lyrics.synced) return -1;
    const posMs = positionSecs * 1000;
    let idx = -1;
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].timeMs <= posMs) idx = i;
      else break;
    }
    return idx;
  }, [lyrics.synced, positionSecs]);

  // Smooth scroll — only when line actually changes
  useEffect(() => {
    if (currentLineIndex === prevLineRef.current) return;
    prevLineRef.current = currentLineIndex;

    const container = scrollRef.current;
    const lineEl = lineRefs.current.get(currentLineIndex);
    if (!container || !lineEl) return;

    const containerH = container.clientHeight;
    const lineTop = lineEl.offsetTop;
    const lineH = lineEl.offsetHeight;
    const target = lineTop - containerH / 2 + lineH / 2;
    const start = container.scrollTop;
    const dist = target - start;

    if (Math.abs(dist) < 1) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const duration = 500;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      // ease-out quart
      const e = 1 - Math.pow(1 - p, 4);
      container.scrollTop = start + dist * e;
      if (p < 1) animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentLineIndex]);

  // Update line styles via DOM directly (no React re-render)
  useEffect(() => {
    if (!lyrics.synced) return;
    lineRefs.current.forEach((el, i) => {
      const isCurrent = i === currentLineIndex;
      const isPast = i < currentLineIndex;
      const distance = isPast ? currentLineIndex - i : i - currentLineIndex;
      const opacity = isCurrent ? 1 : Math.max(0.15, 1 - distance * 0.15);

      el.style.opacity = String(opacity);
      el.style.color = isCurrent
        ? "var(--now-playing)"
        : "var(--text-muted)";
      el.style.fontWeight = isCurrent ? "600" : "400";
    });
  }, [currentLineIndex, lyrics.synced]);

  const setLineRef = useCallback((i: number, el: HTMLDivElement | null) => {
    if (el) lineRefs.current.set(i, el);
    else lineRefs.current.delete(i);
  }, []);

  if (!hasSynced && lyrics.plain) {
    return (
      <div className={styles.lyricsColumn}>
        <div className={styles.lyricsScroll} ref={scrollRef}>
          <div className={styles.plainLyrics}>
            {lyrics.plain.split("\n").map((line, i) => (
              <p key={i} className={styles.plainLine}>{line || "\u00A0"}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!lyrics.synced) return null;

  return (
    <div className={styles.lyricsColumn}>
      <div className={styles.lyricsScroll} ref={scrollRef}>
        <div className={styles.syncedLyrics}>
          <div className={styles.lyricsPadTop} />
          {lyrics.synced.map((line, i) => (
            <div
              key={i}
              ref={(el) => setLineRef(i, el)}
              className={styles.lyricsLine}
              onClick={() => onSeek(line.timeMs)}
            >
              {line.text || "· · ·"}
            </div>
          ))}
          <div className={styles.lyricsPadBottom} />
        </div>
      </div>
    </div>
  );
});

// ── Main NowPlaying ──

export function NowPlaying() {
  const {
    currentTrack,
    isPlaying,
    positionSecs,
    durationSecs,
    volume,
    shuffle,
    repeat,
    togglePlayPause,
    seek,
    setVolume,
    nextTrack,
    prevTrack,
    toggleShuffle,
    cycleRepeat,
    toggleNowPlaying,
  } = usePlayerStore();

  const tracks = useLibraryStore((s) => s.tracks);
  const meta = tracks.find((t) => t.path === currentTrack);

  const [art, setArt] = useState<AlbumArt | null>(null);
  const [artLoaded, setArtLoaded] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentTrack === lastPathRef.current) return;
    lastPathRef.current = currentTrack;
    setArtLoaded(false);
    setArt(null);
    setLyrics(null);
    if (!currentTrack) return;

    commands.getAlbumArt(currentTrack).then((result) => {
      if (lastPathRef.current === currentTrack) setArt(result);
    });

    const trackMeta = tracks.find((t) => t.path === currentTrack);
    if (trackMeta?.title && trackMeta?.artist) {
      const dur = trackMeta.durationMs ? trackMeta.durationMs / 1000 : durationSecs;
      commands
        .fetchLyrics(trackMeta.title, trackMeta.artist, trackMeta.album ?? "", dur)
        .then((result) => {
          if (lastPathRef.current === currentTrack) setLyrics(result);
        })
        .catch(() => {});
    }
  }, [currentTrack, tracks, durationSecs]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => seek(parseFloat(e.target.value)),
    [seek]
  );
  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value)),
    [setVolume]
  );
  const handleLyricSeek = useCallback(
    (timeMs: number) => seek(timeMs / 1000),
    [seek]
  );

  const title = meta?.title ?? extractFileName(currentTrack);
  const artist = meta?.artist ?? "Unknown Artist";
  const album = meta?.album ?? null;
  const year = meta?.year ?? null;
  const format = meta?.format ?? null;
  const sampleRate = meta?.sampleRate ? `${(meta.sampleRate / 1000).toFixed(1)} kHz` : null;
  const bitDepth = meta?.bitDepth ? `${meta.bitDepth}-bit` : null;
  const techInfo = [format, sampleRate, bitDepth].filter(Boolean).join(" · ");
  const progress = durationSecs > 0 ? (positionSecs / durationSecs) * 100 : 0;

  const hasLyrics = !!(lyrics?.synced || lyrics?.plain);

  return (
    <div className={styles.screen}>
      <button className={styles.collapseBtn} onClick={toggleNowPlaying} title="Back to library">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div className={styles.layout}>
        <div className={`${styles.playerColumn} ${hasLyrics ? styles.playerColumnWithLyrics : ""}`}>
          <div className={`${styles.artFrame} ${hasLyrics ? styles.artFrameSmall : ""}`}>
            {art ? (
              <img
                className={`${styles.art} ${artLoaded ? styles.artVisible : ""}`}
                src={`data:${art.mimeType};base64,${art.data}`}
                alt=""
                onLoad={() => setArtLoaded(true)}
                draggable={false}
              />
            ) : (
              <div className={styles.artPlaceholder}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <path d="M38 8v32a7 7 0 11-7-7h7V15L22 19v25a7 7 0 11-7-7h7V12l23-6v2z"
                    stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
                </svg>
              </div>
            )}
          </div>

          <div className={styles.info}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.artist}>{artist}</p>
            {album && <p className={styles.album}>{album}{year ? ` · ${year}` : ""}</p>}
          </div>

          <div className={styles.seekSection}>
            <input type="range" className={styles.seekSlider} min={0} max={durationSecs || 1} step={0.1}
              value={positionSecs} onChange={handleSeek}
              style={{ "--progress": `${progress}%` } as React.CSSProperties} />
            <div className={styles.seekTimes}>
              <span>{formatTime(positionSecs)}</span>
              <span>{formatTime(durationSecs)}</span>
            </div>
          </div>

          <div className={styles.transport}>
            <button className={`${styles.modeBtn} ${shuffle ? styles.modeBtnActive : ""}`} onClick={toggleShuffle} title="Shuffle">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <path d="M1 10h2l3-3-3-3H1" /><path d="M1 4h2l3 3 3-3h2" /><path d="M11 3v2h2" /><path d="M11 9v2h2" /><path d="M8 10h3" />
              </svg>
              {shuffle && <span className={styles.ledDot} />}
            </button>
            <button className={styles.transportBtn} onClick={prevTrack} title="Previous">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1.5" y="3" width="1.8" height="8" rx="0.4" /><path d="M12 3.2L5.5 7l6.5 3.8V3.2z" />
              </svg>
            </button>
            <button className={styles.playBtn} onClick={togglePlayPause} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                  <rect x="5" y="3" width="4" height="16" rx="1" /><rect x="13" y="3" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                  <path d="M6 3l13 8-13 8V3z" />
                </svg>
              )}
            </button>
            <button className={styles.transportBtn} onClick={nextTrack} title="Next">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 3.2L8.5 7 2 10.8V3.2z" /><rect x="10.7" y="3" width="1.8" height="8" rx="0.4" />
              </svg>
            </button>
            <button className={`${styles.modeBtn} ${repeat !== "off" ? styles.modeBtnActive : ""}`} onClick={cycleRepeat} title="Repeat">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 8.5V6a2 2 0 012-2h7" /><path d="M12.5 5.5V8a2 2 0 01-2 2h-7" /><path d="M9 2.5l1.5 1.5L9 5.5" /><path d="M5 8.5L3.5 10 5 11.5" />
              </svg>
              {repeat === "one" && <span className={styles.repeatBadge}>1</span>}
              {repeat !== "off" && <span className={styles.ledDot} />}
            </button>
          </div>

          <div className={styles.volumeRow}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={styles.volIcon}>
              {volume === 0 ? <path d="M7 2.5L4 5H1.5v4H4l3 2.5V2.5z" /> : (
                <><path d="M7 2.5L4 5H1.5v4H4l3 2.5V2.5z" />
                  <path d="M9 5.5c.6.5.6 3 0 3.5" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                  {volume > 0.5 && <path d="M10.2 4c1.2 1 1.2 5 0 6" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />}
                </>
              )}
            </svg>
            <input type="range" className={styles.volumeSlider} min={0} max={1} step={0.01}
              value={volume} onChange={handleVolume}
              style={{ "--progress": `${volume * 100}%` } as React.CSSProperties} />
          </div>

          {techInfo && <p className={styles.techInfo}>{techInfo}</p>}
        </div>

        {lyrics && hasLyrics && (
          <LyricsPanel lyrics={lyrics} onSeek={handleLyricSeek} />
        )}
      </div>
    </div>
  );
}

function extractFileName(path: string | null): string {
  if (!path) return "No track";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1].replace(/\.[^.]+$/, "");
}
