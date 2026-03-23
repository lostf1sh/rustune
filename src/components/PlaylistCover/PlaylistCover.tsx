import { useEffect, useRef, useState } from "react";
import { commands, type Track, type AlbumArt } from "../../lib/commands";
import styles from "./PlaylistCover.module.css";

interface PlaylistCoverProps {
  coverTrackPath: string | null;
  tracks: Track[];
  size: number;
}

export function PlaylistCover({ coverTrackPath, tracks, size }: PlaylistCoverProps) {
  const [coverArt, setCoverArt] = useState<AlbumArt | null>(null);
  const [mosaicArts, setMosaicArts] = useState<(AlbumArt | null)[]>([]);
  const cache = useRef<Map<string, AlbumArt | null>>(new Map());

  // Load single cover art
  useEffect(() => {
    if (!coverTrackPath) {
      setCoverArt(null);
      return;
    }
    if (cache.current.has(coverTrackPath)) {
      setCoverArt(cache.current.get(coverTrackPath) ?? null);
      return;
    }
    commands.getAlbumArt(coverTrackPath).then((art) => {
      cache.current.set(coverTrackPath, art);
      setCoverArt(art);
    });
  }, [coverTrackPath]);

  // Load mosaic arts (first 4 unique tracks with art)
  useEffect(() => {
    if (coverTrackPath) return;

    const artTracks: Track[] = [];
    const seen = new Set<string>();
    for (const t of tracks) {
      if (!t.hasArt) continue;
      const key = t.album ?? t.path;
      if (seen.has(key)) continue;
      seen.add(key);
      artTracks.push(t);
      if (artTracks.length >= 4) break;
    }

    if (artTracks.length === 0) {
      setMosaicArts([]);
      return;
    }

    Promise.all(
      artTracks.map((t) => {
        if (cache.current.has(t.path)) {
          return Promise.resolve(cache.current.get(t.path) ?? null);
        }
        return commands.getAlbumArt(t.path).then((art) => {
          cache.current.set(t.path, art);
          return art;
        });
      })
    ).then(setMosaicArts);
  }, [coverTrackPath, tracks]);

  // Mode 1: Manual cover
  if (coverTrackPath && coverArt) {
    return (
      <div className={styles.cover} style={{ width: size, height: size }}>
        <img
          src={`data:${coverArt.mimeType};base64,${coverArt.data}`}
          className={styles.img}
          draggable={false}
        />
      </div>
    );
  }

  // Mode 2: Mosaic
  if (!coverTrackPath && mosaicArts.length > 0) {
    const tiles = mosaicArts.filter(Boolean) as AlbumArt[];
    if (tiles.length > 0) {
      return (
        <div
          className={`${styles.cover} ${tiles.length >= 4 ? styles.mosaic : ""}`}
          style={{ width: size, height: size }}
        >
          {tiles.length >= 4 ? (
            tiles.slice(0, 4).map((art, i) => (
              <img
                key={i}
                src={`data:${art.mimeType};base64,${art.data}`}
                className={styles.mosaicTile}
                draggable={false}
              />
            ))
          ) : (
            <img
              src={`data:${tiles[0].mimeType};base64,${tiles[0].data}`}
              className={styles.img}
              draggable={false}
            />
          )}
        </div>
      );
    }
  }

  // Mode 3: Placeholder
  return (
    <div className={styles.cover} style={{ width: size, height: size }}>
      <div className={styles.placeholder}>
        <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 13 13" fill="none">
          <path d="M2 3h7M2 6h5M2 9h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M10 4.5v5a1.5 1.5 0 11-1.5-1.5H10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
