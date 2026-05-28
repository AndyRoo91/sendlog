import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { api } from "../api/client";
import type { ProgressData, ProgressPoint, LeadPyramidRow } from "../api/client";
import { format } from "date-fns";

const BOULDER_GRADES = [
  "V0","V1","V2","V3","V4","V5","V6","V7","V8","V9",
  "V10","V11","V12","V13","V14","V15","V16",
];

const INK = "#1a1612";
const ONSIGHT = "#e88aa3"; // pink
const FLASH = "#e8a83b";   // mustard
const SEA = "#2d8a73";     // redpoint / send

const AXIS = { fontSize: 12, fontFamily: "var(--font-banner)" } as const;
const GRID = "rgba(26,22,18,0.15)";
const TOOLTIP_STYLE = { background: "#fbf0d4", border: "2px solid #1a1612", borderRadius: 0, fontFamily: "var(--font-body)" };

function ChartCard({
  title, data, color, yTickFormatter, tooltipFormatter,
}: {
  title: string;
  data: ProgressPoint[];
  color: string;
  yTickFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>{title}</h2>
        <p className="muted" style={{ fontSize: 13 }}>No data yet — log some sessions to see progress.</p>
      </div>
    );
  }
  const chartData = data.map((p) => ({ date: format(new Date(p.date), "MMM d"), value: p.value }));
  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{title}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" stroke="#3a2e22" tick={AXIS} />
          <YAxis stroke="#3a2e22" tick={AXIS} tickFormatter={yTickFormatter} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v) => tooltipFormatter ? tooltipFormatter(v as number) : v} />
          <Line type="monotone" dataKey="value" name={title} stroke={color} strokeWidth={3}
            dot={{ r: 4, fill: color, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Three-line lead progression: hardest onsight vs flash vs redpoint per session (Ewbank). */
function LeadProgression({ onsight, flash, redpoint }: { onsight: ProgressPoint[]; flash: ProgressPoint[]; redpoint: ProgressPoint[] }) {
  if (onsight.length === 0 && flash.length === 0 && redpoint.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Lead — Onsight / Flash / Redpoint (Ewbank)</h2>
        <p className="muted" style={{ fontSize: 13 }}>No lead sends logged yet.</p>
      </div>
    );
  }
  // merge series by date
  const byDate: Record<string, { date: string; onsight?: number; flash?: number; redpoint?: number }> = {};
  for (const p of onsight) {
    const d = format(new Date(p.date), "MMM d");
    (byDate[d] ??= { date: d }).onsight = p.value;
  }
  for (const p of flash) {
    const d = format(new Date(p.date), "MMM d");
    (byDate[d] ??= { date: d }).flash = p.value;
  }
  for (const p of redpoint) {
    const d = format(new Date(p.date), "MMM d");
    (byDate[d] ??= { date: d }).redpoint = p.value;
  }
  const merged = Object.values(byDate);

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Lead — Onsight / Flash / Redpoint (Ewbank)</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={merged} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" stroke="#3a2e22" tick={AXIS} />
          <YAxis stroke="#3a2e22" tick={AXIS} width={36} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }} />
          <Legend wrapperStyle={{ fontFamily: "var(--font-banner)", fontSize: 11 }} />
          <Line type="monotone" dataKey="onsight" name="ONSIGHT" stroke={ONSIGHT} strokeWidth={3} connectNulls
            dot={{ r: 4, fill: ONSIGHT, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
          <Line type="monotone" dataKey="flash" name="FLASH" stroke={FLASH} strokeWidth={3} connectNulls
            dot={{ r: 4, fill: FLASH, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
          <Line type="monotone" dataKey="redpoint" name="REDPOINT" stroke={SEA} strokeWidth={3} connectNulls
            dot={{ r: 4, fill: SEA, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Aggregate send pyramid — flash + redpoint stacked, hardest grade at top. */
function LeadPyramid({ rows }: { rows: LeadPyramidRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Lead — Send Pyramid (Ewbank)</h2>
        <p className="muted" style={{ fontSize: 13 }}>No lead sends logged yet.</p>
      </div>
    );
  }
  const height = Math.max(140, rows.length * 34 + 40);
  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Lead — Send Pyramid (Ewbank)</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke="#3a2e22" tick={AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey="grade" stroke="#3a2e22" tick={AXIS} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }} />
          <Legend wrapperStyle={{ fontFamily: "var(--font-banner)", fontSize: 11 }} />
          <Bar dataKey="onsight" name="ONSIGHT" stackId="a" fill={ONSIGHT} stroke={INK} strokeWidth={2} />
          <Bar dataKey="flash" name="FLASH" stackId="a" fill={FLASH} stroke={INK} strokeWidth={2} />
          <Bar dataKey="redpoint" name="REDPOINT" stackId="a" fill={SEA} stroke={INK} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => { api.getProgress().then(setData); }, []);

  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1 style={{ marginBottom: 24 }}>Progress</h1>
      <div className="gap-col">
        <LeadProgression onsight={data.lead_onsight_progression} flash={data.lead_flash_progression} redpoint={data.lead_redpoint_progression} />
        <LeadPyramid rows={data.lead_send_pyramid} />
        <ChartCard
          title="Limit Boulder Max Grade (Sends)"
          data={data.boulder_max_grade}
          color={SEA}
          yTickFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
          tooltipFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
        />
        <ChartCard
          title="Fingerboard Max Added Weight"
          data={data.fingerboard_max_weight}
          color="#2a4a8a"
          yTickFormatter={(v) => `${v}kg`}
          tooltipFormatter={(v) => `${v} kg`}
        />
        <ChartCard
          title="Strength Max Added Weight"
          data={data.strength_max_weight}
          color={FLASH}
          yTickFormatter={(v) => `${v}kg`}
          tooltipFormatter={(v) => `${v} kg`}
        />
      </div>
    </div>
  );
}
