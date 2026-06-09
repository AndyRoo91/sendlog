import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { FingerboardProtocol } from "../api/client";
import { BUILTIN_PROTOCOLS } from "../lib/protocols";
import { onKey } from "../lib/a11y";

export interface FbFormValues {
  edge_mm: number | null;
  added_weight_kg: number | null;
  hang_duration_s: number | null;
  num_sets: number | null;
  notes: string | null;
}

const chip = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px",
  cursor: "pointer", whiteSpace: "nowrap",
  fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.05em",
  border: "var(--b) solid var(--ink)",
  background: active ? "var(--cobalt)" : "transparent",
  color: active ? "var(--cream)" : "var(--ink)",
  boxShadow: active ? "2px 2px 0 var(--ink)" : "none",
});

/** Tap a protocol to prefill the fingerboard form; save the current values as
 *  a custom protocol. Built-ins are fixed; custom ones can be deleted. */
export default function ProtocolPicker({ form, setForm }: {
  form: FbFormValues; setForm: (f: FbFormValues) => void;
}) {
  const [custom, setCustom] = useState<FingerboardProtocol[]>([]);

  useEffect(() => { api.listProtocols().then(setCustom).catch(() => {}); }, []);

  function apply(p: FingerboardProtocol) {
    setForm({
      ...form,
      edge_mm: p.edge_mm ?? null,
      added_weight_kg: p.added_weight_kg ?? null,
      hang_duration_s: p.hang_duration_s ?? null,
      num_sets: p.num_sets ?? null,
      notes: p.notes ?? null,
    });
  }

  function matches(p: FingerboardProtocol): boolean {
    return p.edge_mm === form.edge_mm && p.added_weight_kg === form.added_weight_kg &&
      p.hang_duration_s === form.hang_duration_s && p.num_sets === form.num_sets &&
      (p.notes ?? null) === form.notes;
  }

  async function saveAs() {
    const name = window.prompt("Save these settings as a protocol — name it:");
    if (!name || !name.trim()) return;
    try {
      const p = await api.createProtocol({ name: name.trim(), ...form });
      setCustom((c) => [...c, p].sort((a, b) => a.name.localeCompare(b.name)));
    } catch { /* surfaced elsewhere; keep the form intact */ }
  }

  async function del(id: number) {
    try { await api.deleteProtocol(id); setCustom((c) => c.filter((x) => x.id !== id)); }
    catch { /* ignore */ }
  }

  const hasValues = form.edge_mm != null || form.hang_duration_s != null ||
    form.num_sets != null || form.added_weight_kg != null;

  return (
    <div>
      <label style={{ display: "block", marginBottom: 4 }}>Protocol · optional</label>
      <div className="gap-row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
        {BUILTIN_PROTOCOLS.map((p) => (
          <div key={p.name} role="button" tabIndex={0} title={p.notes ?? undefined}
            onClick={() => apply(p)} onKeyDown={onKey(() => apply(p))} style={chip(matches(p))}>
            {p.name}
          </div>
        ))}
        {custom.map((p) => (
          <div key={p.id} role="button" tabIndex={0} title={p.notes ?? undefined}
            onClick={() => apply(p)} onKeyDown={onKey(() => apply(p))} style={chip(matches(p))}>
            {p.name}
            <span role="button" tabIndex={0} aria-label={`Delete ${p.name}`}
              onClick={(e) => { e.stopPropagation(); del(p.id!); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === " ") del(p.id!); }}
              style={{ opacity: 0.7 }}>✕</span>
          </div>
        ))}
        {hasValues && (
          <div role="button" tabIndex={0} onClick={saveAs} onKeyDown={onKey(saveAs)}
            style={{ ...chip(false), borderStyle: "dashed", color: "var(--ink-2)" }}>
            + save
          </div>
        )}
      </div>
    </div>
  );
}
