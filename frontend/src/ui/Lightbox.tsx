import { useEffect } from "react";

interface Props {
  src: string;
  onClose: () => void;
}

/** Full-screen photo lightbox. Tap backdrop or ✕ to dismiss. ESC key also closes. */
export default function Lightbox({ src, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo lightbox"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(26,22,18,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <img
        src={src}
        alt="Full size photo"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "96vw", maxHeight: "88vh",
          objectFit: "contain",
          border: "var(--bw) solid var(--ink)",
          boxShadow: "6px 6px 0 var(--ink)",
        }}
      />
      <button
        onClick={onClose}
        aria-label="Close photo"
        style={{
          position: "absolute", top: 16, right: 16,
          fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.08em",
          color: "var(--cream)", background: "var(--ink)",
          border: "var(--b) solid var(--cream)",
          padding: "5px 10px", cursor: "pointer",
          borderRadius: 0,
        }}
      >
        ✕ CLOSE
      </button>
    </div>
  );
}
