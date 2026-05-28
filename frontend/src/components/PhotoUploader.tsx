import { useRef, useState } from "react";
import { api } from "../api/client";
import type { EntryPhoto } from "../api/client";
import { thumbUrl, photoUrl } from "../lib/photos";
import { Lightbox } from "../ui";

interface Props {
  entryType: "lead" | "boulder" | "route";
  entryId: number;
  photos: EntryPhoto[];
  onChange: (photos: EntryPhoto[]) => void;
  /** Optional: called when a photo should become the route topo. */
  onSetTopo?: (photoId: number) => void;
}

export default function PhotoUploader({ entryType, entryId, photos, onChange, onSetTopo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: EntryPhoto[] = [];
      for (const file of Array.from(files)) {
        const photo = await api.uploadPhoto(entryType, entryId, file);
        uploaded.push(photo);
      }
      onChange([...photos, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: number) {
    await api.deletePhoto(photoId);
    onChange(photos.filter((p) => p.id !== photoId));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: photos.length ? 8 : 0 }}>
        {photos.map((p) => (
          <div key={p.id} style={{ position: "relative" }}>
            <img
              src={thumbUrl(p.filename)}
              alt="Climb photo"
              onClick={() => setLightbox(photoUrl(p.filename))}
              style={{
                width: 80, height: 80, objectFit: "cover",
                border: "var(--b) solid var(--ink)",
                cursor: "pointer",
              }}
            />
            {onSetTopo && (
              <div
                onClick={() => onSetTopo(p.id)}
                title="Set as topo"
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(26,22,18,0.7)", color: "var(--mustard)",
                  fontFamily: "var(--font-banner)", fontSize: 8, letterSpacing: "0.06em",
                  textAlign: "center", padding: "2px 0", cursor: "pointer",
                }}
              >
                SET TOPO
              </div>
            )}
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              style={{
                position: "absolute", top: -6, right: -6,
                width: 20, height: 20, borderRadius: "50%",
                background: "var(--red)", color: "var(--cream)",
                border: "var(--b) solid var(--ink)",
                fontSize: 12, padding: 0, lineHeight: "18px",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "📷 Add photo"}
      </button>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
