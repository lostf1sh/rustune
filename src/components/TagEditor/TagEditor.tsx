import { useEffect, useState } from "react";
import { commands, type TagUpdate } from "../../lib/commands";
import styles from "./TagEditor.module.css";

interface TagEditorProps {
  path: string;
  onClose: () => void;
  onSaved: () => void;
}

export function TagEditor({ path, onClose, onSaved }: TagEditorProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [discNumber, setDiscNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    commands.readTags(path).then((info) => {
      setTitle(info.title ?? "");
      setArtist(info.artist ?? "");
      setAlbum(info.album ?? "");
      setAlbumArtist(info.albumArtist ?? "");
      setGenre(info.genre ?? "");
      setYear(info.year?.toString() ?? "");
      setTrackNumber(info.trackNumber?.toString() ?? "");
      setDiscNumber(info.discNumber?.toString() ?? "");
      setLoading(false);
    });
  }, [path]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const tags: TagUpdate = {
      title: title || null,
      artist: artist || null,
      album: album || null,
      albumArtist: albumArtist || null,
      genre: genre || null,
      year: year ? parseInt(year, 10) : null,
      trackNumber: trackNumber ? parseInt(trackNumber, 10) : null,
      discNumber: discNumber ? parseInt(discNumber, 10) : null,
    };

    try {
      await commands.writeTags(path, tags);
      onSaved();
      onClose();
    } catch (e) {
      console.error("Failed to write tags:", e);
      setSaving(false);
    }
  };

  const fileName = path.split(/[/\\]/).pop() ?? path;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.heading}>Edit Tags</h2>
          <span className={styles.fileName}>{fileName}</span>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <span className={styles.spinner} />
          </div>
        ) : (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Title</label>
              <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Artist</label>
              <input className={styles.input} value={artist} onChange={(e) => setArtist(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Album</label>
              <input className={styles.input} value={album} onChange={(e) => setAlbum(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Album Artist</label>
              <input className={styles.input} value={albumArtist} onChange={(e) => setAlbumArtist(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Genre</label>
              <input className={styles.input} value={genre} onChange={(e) => setGenre(e.target.value)} />
            </div>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Year</label>
                <input className={styles.input} type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Track #</label>
                <input className={styles.input} type="number" value={trackNumber} onChange={(e) => setTrackNumber(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Disc #</label>
                <input className={styles.input} type="number" value={discNumber} onChange={(e) => setDiscNumber(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
