import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import styles from "./TitleBar.module.css";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized);

    const unMax = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    });

    return () => {
      unMax.then((fn) => fn());
    };
  }, [appWindow]);

  return (
    <div className={styles.titlebar} data-tauri-drag-region>
      <div className={styles.brand} data-tauri-drag-region>
        <span className={styles.logo}>R</span>
        <span className={styles.name} data-tauri-drag-region>
          rustune
        </span>
      </div>

      <div className={styles.controls}>
        <button
          className={styles.controlBtn}
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        <button
          className={styles.controlBtn}
          onClick={() => appWindow.toggleMaximize()}
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.6" y="2.6" width="6.8" height="6.8" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" />
              <path d="M2.6 2.6V1.6a1 1 0 011-1h5.8a1 1 0 011 1v5.8a1 1 0 01-1 1H8.4" stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          )}
        </button>

        <button
          className={`${styles.controlBtn} ${styles.closeBtn}`}
          onClick={() => appWindow.close()}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
