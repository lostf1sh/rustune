import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import styles from "./QueuePanel.module.css";

const QUEUE_ROW_ESTIMATE_PX = 40;

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function QueuePanel() {
  const {
    queue,
    queueIndex,
    queueOpen,
    toggleQueue,
    isPlaying,
    playQueue,
    removeFromQueue,
    clearQueue,
  } = usePlayerStore();

  const trackByPath = useLibraryStore((s) => s.trackByPath);

  const listRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: queue.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => QUEUE_ROW_ESTIMATE_PX,
    overscan: 10,
    getItemKey: (index) => `${queue[index]}-${index}`,
  });

  useEffect(() => {
    if (queueOpen && queue.length > 0 && queueIndex != null) {
      rowVirtualizer.scrollToIndex(queueIndex, { align: "center" });
    }
  }, [queueOpen, queueIndex, queue.length, rowVirtualizer]);

  const handleJump = (index: number) => {
    playQueue(queue, index);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${queueOpen ? styles.backdropVisible : ""}`}
        onClick={toggleQueue}
      />

      {/* Panel */}
      <div className={`${styles.panel} ${queueOpen ? styles.panelOpen : ""}`}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Queue</h2>
            <span className={styles.count}>{queue.length}</span>
          </div>
          {queue.length > 0 && (
            <button className={styles.clearBtn} onClick={clearQueue}>
              Clear
            </button>
          )}
        </div>

        <div className={styles.list} ref={listRef}>
          {queue.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>Queue is empty</p>
              <p className={styles.emptyHint}>
                Double-click a track to start playing
              </p>
            </div>
          ) : (
            <div
              className={styles.virtualBody}
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const i = virtualRow.index;
                const path = queue[i]!;
                const meta = trackByPath[path];
                const isCurrent = i === queueIndex;
                const title = meta?.title ?? extractFileName(path);
                const artist = meta?.artist ?? null;

                return (
                  <div
                    key={`${path}-${i}`}
                    className={styles.virtualRowHost}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div
                      className={`${styles.item} ${isCurrent ? styles.itemActive : ""}`}
                      onClick={() => handleJump(i)}
                    >
                      <div className={styles.itemIndex}>
                        {isCurrent && isPlaying ? (
                          <div className={styles.eqBars}>
                            <span className={styles.eqBar} style={{ animationDelay: "0ms" }} />
                            <span className={styles.eqBar} style={{ animationDelay: "160ms" }} />
                            <span className={styles.eqBar} style={{ animationDelay: "80ms" }} />
                          </div>
                        ) : (
                          <span className={isCurrent ? styles.indexActive : ""}>
                            {i + 1}
                          </span>
                        )}
                      </div>

                      <div className={styles.itemInfo}>
                        <span className={`${styles.itemTitle} ${isCurrent ? styles.itemTitleActive : ""}`}>
                          {title}
                        </span>
                        {artist && (
                          <span className={styles.itemArtist}>{artist}</span>
                        )}
                      </div>

                      <span className={styles.itemDuration}>
                        {formatDuration(meta?.durationMs ?? null)}
                      </span>

                      <button
                        className={styles.removeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(i);
                        }}
                        title="Remove"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                          <path d="M2 2l6 6M8 2l-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function extractFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1].replace(/\.[^.]+$/, "");
}
