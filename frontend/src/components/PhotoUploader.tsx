import { useRef, useState } from "react";
import { api } from "../api/client";
import type { EntryPhoto } from "../api/client";

interface Props {
  entryType: "lead" | "boulder";
  entryId: number;
  photos: EntryPhoto[];
  onChange: (photos: EntryPhoto[]) => void;
}

export default function PhotoUploader({ entryType, entryId, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
              src={`/photos/${p.filename}`}
              alt="Climb photo"
              style={{
                width: 80, height: 80, objectFit: "cover",
                borderRadius: 8, border: "1px solid var(--border)",
              }}
            />
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              style={{
                position: "absolute", top: -6, right: -6,
                width: 20, height: 20, borderRadius: "50%",
                background: "var(--danger)", color: "#fff",
                fontSize: 12, padding: 0, lineHeight: "20px",
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
    </div>
  );
}
