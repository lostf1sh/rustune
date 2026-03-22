import { open } from "@tauri-apps/plugin-dialog";
import { useLibraryStore } from "../../stores/libraryStore";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const { trackCount, isScanning, scanFolder } = useLibraryStore();

  const handleAddFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Folder",
    });

    if (selected) {
      await scanFolder(selected);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>R</span>
        <span className={styles.brandName}>rustune</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>BROWSE</span>
          <button className={`${styles.navItem} ${styles.active}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M13.5 13.5H1.5V1.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M4 10V6M7 10V4M10 10V7.5M13 10V2"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            Library
          </button>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>PLAYLISTS</span>
          <p className={styles.emptyHint}>No playlists yet</p>
        </div>
      </nav>

      <div className={styles.bottom}>
        <button
          className={styles.addBtn}
          onClick={handleAddFolder}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <span className={styles.spinner} />
              Scanning...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 2v10M2 7h10"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              Add Folder
            </>
          )}
        </button>

        {trackCount > 0 && (
          <span className={styles.trackCount}>
            {trackCount.toLocaleString()} tracks
          </span>
        )}
      </div>
    </aside>
  );
}
