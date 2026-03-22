import { useEffect } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import styles from "./SettingsView.module.css";

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ""}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

export function SettingsView() {
  const { settings, loaded, loadSettings, updateSettings, resetSettings } =
    useSettingsStore();

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  if (!loaded) return null;

  const volumePercent = Math.round(settings.defaultVolume * 100);

  return (
    <div className={styles.container}>
      <div className={styles.scroll}>
        <div className={styles.inner}>
          <h1 className={styles.pageTitle}>Settings</h1>

          {/* Library */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Library</h2>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Auto-watch folders</span>
                <span className={styles.desc}>
                  Automatically detect new, changed, or removed files
                </span>
              </div>
              <Toggle
                value={settings.autoWatch}
                onChange={(v) => updateSettings({ autoWatch: v })}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Scan on startup</span>
                <span className={styles.desc}>
                  Re-scan all library folders when the app starts
                </span>
              </div>
              <Toggle
                value={settings.scanOnStartup}
                onChange={(v) => updateSettings({ scanOnStartup: v })}
              />
            </div>
          </section>

          {/* Playback */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Playback</h2>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Default volume</span>
                <span className={styles.desc}>
                  Initial volume when the app starts — {volumePercent}%
                </span>
              </div>
              <div className={styles.sliderWrap}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumePercent}
                  onChange={(e) =>
                    updateSettings({ defaultVolume: Number(e.target.value) / 100 })
                  }
                  className={styles.slider}
                  style={{ "--progress": `${volumePercent}%` } as React.CSSProperties}
                />
              </div>
            </div>
          </section>

          {/* Lyrics */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Lyrics</h2>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Auto-fetch lyrics</span>
                <span className={styles.desc}>
                  Automatically search for lyrics when a track plays
                </span>
              </div>
              <Toggle
                value={settings.autoFetchLyrics}
                onChange={(v) => updateSettings({ autoFetchLyrics: v })}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Prefer local .lrc files</span>
                <span className={styles.desc}>
                  Check for a .lrc file next to the audio file before fetching online
                </span>
              </div>
              <Toggle
                value={settings.preferLocalLrc}
                onChange={(v) => updateSettings({ preferLocalLrc: v })}
              />
            </div>
          </section>

          {/* Appearance */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Compact mode</span>
                <span className={styles.desc}>
                  Reduce padding and spacing throughout the interface
                </span>
              </div>
              <Toggle
                value={settings.compactMode}
                onChange={(v) => updateSettings({ compactMode: v })}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.label}>Show queue badge</span>
                <span className={styles.desc}>
                  Display track count badge on the queue button
                </span>
              </div>
              <Toggle
                value={settings.showQueueBadge}
                onChange={(v) => updateSettings({ showQueueBadge: v })}
              />
            </div>
          </section>

          {/* Reset */}
          <div className={styles.resetArea}>
            <button className={styles.resetBtn} onClick={resetSettings}>
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
