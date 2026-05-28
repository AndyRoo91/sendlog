import { useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { RoutePin } from "../api/client";
import { PIN_KINDS, pinKind } from "../lib/pins";

interface Props {
  routeId: number;
  topoFilename: string;
  pins: RoutePin[];
  onChange: (pins: RoutePin[]) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

/** Fullscreen topo viewer: tap to drop a pin, drag an existing pin to reposition. */
export default function TopoPinEditor({ routeId, topoFilename, pins, onChange, onClose }: Props) {
  const [activeKind, setActiveKind] = useState("highpoint");
  const [date, setDate] = useState(today());
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Drag state — tracked outside React state so it doesn't trigger re-renders mid-drag
  const drag = useRef<{ pinId: number; moved: boolean } | null>(null);

  // chronological order → marker numbering + recency fade
  const ordered = useMemo(
    () => [...pins].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)),
    [pins]
  );
  const numberOf = useMemo(() => {
    const m: Record<number, number> = {};
    ordered.forEach((p, i) => { m[p.id] = i + 1; });
    return m;
  }, [ordered]);
  const latestDate = ordered.length ? ordered[ordered.length - 1].date : "";

  function imgCoords(clientX: number, clientY: number) {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  async function placePin(e: React.MouseEvent<HTMLDivElement>) {
    if (busy || drag.current?.moved) return;
    const coords = imgCoords(e.clientX, e.clientY);
    if (!coords) return;
    setBusy(true);
    try {
      const pin = await api.addPin(routeId, { date, x: coords.x, y: coords.y, kind: activeKind, note: null });
      onChange([...pins, pin]);
      setSelected(pin.id);
    } finally { setBusy(false); }
  }

  // --- Drag handlers on each pin marker ---
  function onPinPointerDown(e: React.PointerEvent, pinId: number) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pinId, moved: false };
    setSelected(pinId);
  }

  function onPinPointerMove(e: React.PointerEvent, pinId: number) {
    if (!drag.current || drag.current.pinId !== pinId) return;
    const coords = imgCoords(e.clientX, e.clientY);
    if (!coords) return;
    drag.current.moved = true;
    // Move the pin visually by updating local state immediately
    onChange(pins.map((p) => p.id === pinId ? { ...p, x: coords.x, y: coords.y } : p));
  }

  async function onPinPointerUp(_e: React.PointerEvent, pinId: number) {
    if (!drag.current || drag.current.pinId !== pinId) return;
    const wasMoved = drag.current.moved;
    drag.current = null;
    if (!wasMoved) return; // just a tap — handled by click
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    // Persist the new position
    const updated = await api.updatePin(pinId, { x: pin.x, y: pin.y });
    onChange(pins.map((p) => p.id === pinId ? updated : p));
  }

  async function removePin(id: number) {
    await api.deletePin(id);
    onChange(pins.filter((p) => p.id !== id));
    setSelected(null);
  }

  async function setNote(id: number, note: string) {
    const updated = await api.updatePin(id, { note: note || null });
    onChange(pins.map((p) => p.id === id ? updated : p));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(26,22,18,0.92)", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px", color: "var(--cream)" }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.08em", flex: 1 }}>★ TAP TO DROP · DRAG TO MOVE</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto", fontSize: 12, padding: "4px 8px" }} />
        <button className="btn-secondary btn-sm" onClick={onClose}>Done</button>
      </div>

      {/* Kind selector */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 10px", flexWrap: "wrap" }}>
        {PIN_KINDS.map((k) => (
          <div key={k.id} className="chunky" onClick={() => setActiveKind(k.id)}
            style={{
              padding: "4px 9px", fontSize: 10, fontFamily: "var(--font-banner)", letterSpacing: "0.04em",
              background: k.color, color: k.id === "highpoint" || k.id === "crux" ? "var(--ink)" : "var(--cream)",
              boxShadow: activeKind === k.id ? "0 0 0 3px var(--cream)" : "none",
            }}>
            {k.star ? "★ " : ""}{k.label.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Image with pins */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 8px" }}>
        <div style={{ position: "relative", maxHeight: "100%", maxWidth: "100%" }} onClick={placePin}>
          <img
            ref={imgRef}
            src={`/photos/${topoFilename}`}
            alt="Route topo"
            style={{ display: "block", maxHeight: "62vh", maxWidth: "100%", border: "var(--bw) solid var(--ink)", cursor: busy ? "wait" : "crosshair" }}
          />
          {ordered.map((p) => {
            const k = pinKind(p.kind);
            const faded = p.date < latestDate;
            return (
              <div
                key={p.id}
                onPointerDown={(e) => onPinPointerDown(e, p.id)}
                onPointerMove={(e) => onPinPointerMove(e, p.id)}
                onPointerUp={(e) => onPinPointerUp(e, p.id)}
                onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) setSelected(selected === p.id ? null : p.id); }}
                style={{
                  position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                  transform: "translate(-50%, -50%)", cursor: "grab",
                  width: 26, height: 26, borderRadius: "50%",
                  background: k.color, border: "2.5px solid var(--ink)",
                  color: k.id === "highpoint" || k.id === "crux" ? "var(--ink)" : "var(--cream)",
                  fontFamily: "var(--font-display)", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: faded ? 0.45 : 1,
                  boxShadow: selected === p.id ? "0 0 0 3px var(--cream)" : "2px 2px 0 var(--ink)",
                  touchAction: "none",
                }}>
                {k.star ? "★" : numberOf[p.id]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progression list */}
      <div className="no-scrollbar" style={{ maxHeight: "26vh", overflow: "auto", background: "var(--paper)", borderTop: "var(--bw) solid var(--ink)", padding: "10px 14px" }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)", marginBottom: 8 }}>
          PROGRESSION · {ordered.length} PIN{ordered.length === 1 ? "" : "S"}
        </div>
        {ordered.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No pins yet — tap the photo above.</p>}
        {ordered.map((p) => {
          const k = pinKind(p.kind);
          return (
            <div key={p.id} className="gap-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div className="gap-row" style={{ gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: k.color, border: "2px solid var(--ink)", color: k.id === "highpoint" || k.id === "crux" ? "var(--ink)" : "var(--cream)", fontFamily: "var(--font-display)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {k.star ? "★" : numberOf[p.id]}
                </span>
                <span style={{ fontFamily: "var(--font-banner)", fontSize: 11 }}>{p.date}</span>
                <span className="tag" style={{ background: k.color, color: k.id === "highpoint" || k.id === "crux" ? "var(--ink)" : "var(--cream)" }}>{k.label}</span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => removePin(p.id)}>✕</button>
            </div>
          );
        })}
        {selected != null && (() => {
          const p = pins.find((x) => x.id === selected);
          if (!p) return null;
          return (
            <div style={{ marginTop: 6 }}>
              <label>Note for pin {numberOf[p.id]}</label>
              <input defaultValue={p.note ?? ""} placeholder="e.g. dropped at the rail"
                onBlur={(e) => setNote(p.id, e.target.value)} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
