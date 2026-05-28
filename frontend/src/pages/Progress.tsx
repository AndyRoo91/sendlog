import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { api } from "../api/client";
import type {
  ProgressData, ProgressPoint, LeadPyramidRow, BoulderPyramidRow,
  MoodSendRatePoint, LocationBreakdownRow, AttemptsHistogramRow, PBTimelinePoint,
} from "../api/client";
import { format } from "date-fns";
import { Ribbon } from "../ui";

const CHART_CARD_CLS = "card-flat offset-ink";
const CHART_TITLE_STYLE = {
  fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.1em",
  marginBottom: 14, color: "var(--ink)",
} as const;

const BOULDER_GRADES = [
  "V0","V1","V2","V3","V4","V5","V6","V7","V8","V9",
  "V10","V11","V12","V13","V14","V15","V16",
];

const INK = "#1a1612";
const ONSIGHT = "#e88aa3"; // pink
const FLASH = "#e8a83b";   // mustard
const SEA = "#2d8a73";     // redpoint / send
const COBALT = "#2a4a8a";  // lead PB
const RED = "#c0382b";     // attempts / boulder PB

const MOOD_EMOJI = ["😩", "😕", "🙂", "😎", "🔥"];
const MOOD_LABEL = ["COOKED", "FLAT", "OK", "SENDY", "FIRE"];


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
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>{title}</div>
        <p className="muted" style={{ fontSize: 13 }}>No data yet — log some sessions to see progress.</p>
      </div>
    );
  }
  const chartData = data.map((p) => ({ date: format(new Date(p.date), "MMM d"), value: p.value }));
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>{title}</div>
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
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Lead — Onsight / Flash / Redpoint (Ewbank)</div>
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
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Lead — Onsight / Flash / Redpoint (Ewbank)</div>
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
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Lead — Send Pyramid (Ewbank)</div>
        <p className="muted" style={{ fontSize: 13 }}>No lead sends logged yet.</p>
      </div>
    );
  }
  const height = Math.max(140, rows.length * 34 + 40);
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Lead — Send Pyramid (Ewbank)</div>
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

/** Session volume — total ticks per session as a bar chart. */
function VolumeChart({ data }: { data: ProgressPoint[] }) {
  if (data.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Session Volume (ticks per session)</div>
        <p className="muted" style={{ fontSize: 13 }}>No sessions with climbing entries yet.</p>
      </div>
    );
  }
  const chartData = data.map((p) => ({ date: format(new Date(p.date), "MMM d"), value: p.value }));
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Session Volume (ticks per session)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="date" stroke="#3a2e22" tick={AXIS} />
          <YAxis stroke="#3a2e22" tick={AXIS} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v) => [`${v} ticks`, "Volume"]} />
          <Bar dataKey="value" name="Ticks" fill={SEA} stroke={INK} strokeWidth={2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Boulder send pyramid — flash + send stacked, hardest grade at top. */
function BoulderPyramid({ rows }: { rows: BoulderPyramidRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Boulder — Send Pyramid (V-scale)</div>
        <p className="muted" style={{ fontSize: 13 }}>No boulder sends logged yet.</p>
      </div>
    );
  }
  const height = Math.max(140, rows.length * 34 + 40);
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Boulder — Send Pyramid (V-scale)</div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke="#3a2e22" tick={AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey="grade" stroke="#3a2e22" tick={AXIS} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }} />
          <Legend wrapperStyle={{ fontFamily: "var(--font-banner)", fontSize: 11 }} />
          <Bar dataKey="flash" name="FLASH" stackId="a" fill={FLASH} stroke={INK} strokeWidth={2} />
          <Bar dataKey="send" name="SEND" stackId="a" fill={SEA} stroke={INK} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mood vs send-rate: bar chart, x = mood emoji, y = average send rate %. */
function MoodVsSendRate({ rows }: { rows: MoodSendRatePoint[] }) {
  if (rows.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Mood vs Send Rate</div>
        <p className="muted" style={{ fontSize: 13 }}>
          Rate sessions when you wrap them up to start seeing this correlation.
        </p>
      </div>
    );
  }
  const data = rows.map((r) => ({
    mood: MOOD_EMOJI[r.mood - 1] ?? String(r.mood),
    label: MOOD_LABEL[r.mood - 1] ?? "",
    send_rate: r.send_rate,
    sessions: r.sessions,
  }));
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Mood vs Send Rate (%)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="mood" stroke="#3a2e22" tick={{ ...AXIS, fontSize: 18 }} />
          <YAxis stroke="#3a2e22" tick={AXIS} width={42} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v, _name, ctx) => [`${v}% · ${ctx.payload.sessions} session${ctx.payload.sessions === 1 ? "" : "s"}`, ctx.payload.label]}
          />
          <Bar dataKey="send_rate" name="Send rate" fill={SEA} stroke={INK} strokeWidth={2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Crag/gym breakdown: horizontal bar of send rate (%) per location. */
function LocationBreakdown({ rows }: { rows: LocationBreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Crag / Gym Breakdown</div>
        <p className="muted" style={{ fontSize: 13 }}>Log some sessions with a location to see this chart.</p>
      </div>
    );
  }
  const data = rows.map((r) => ({
    location: r.location,
    send_rate: r.send_rate,
    sessions: r.sessions,
    total_ticks: r.total_ticks,
  }));
  const height = Math.max(140, rows.length * 38 + 40);
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Crag / Gym — Send Rate by Location</div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke="#3a2e22" tick={AXIS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="location" stroke="#3a2e22" tick={AXIS} width={110} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v, _name, ctx) => [
              `${v}% · ${ctx.payload.sessions} session${ctx.payload.sessions === 1 ? "" : "s"} · ${ctx.payload.total_ticks} ticks`,
              "Send rate",
            ]} />
          <Bar dataKey="send_rate" name="Send rate" fill={FLASH} stroke={INK} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Attempts histogram: bar of send count bucketed by attempts (1, 2, 3, 4, 5+). */
function AttemptsHistogram({ rows }: { rows: AttemptsHistogramRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Attempts to Send</div>
        <p className="muted" style={{ fontSize: 13 }}>No sends with attempt counts yet.</p>
      </div>
    );
  }
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Attempts to Send</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="bucket" stroke="#3a2e22" tick={AXIS} />
          <YAxis stroke="#3a2e22" tick={AXIS} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v) => [`${v} send${v === 1 ? "" : "s"}`, "Count"]}
            labelFormatter={(l) => `${l} attempt${l === "1" ? "" : "s"}`} />
          <Bar dataKey="count" name="Sends" fill={RED} stroke={INK} strokeWidth={2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** PB timeline: running max grade per session that improved either ladder.
 *  Dual y-axis since Ewbank (1..38) and V-scale (0..16) live on different scales. */
function PBTimeline({ points }: { points: PBTimelinePoint[] }) {
  if (points.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Personal Best Timeline</div>
        <p className="muted" style={{ fontSize: 13 }}>No sends logged yet.</p>
      </div>
    );
  }
  const data = points.map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    lead_pb: p.lead_pb ?? undefined,
    boulder_pb: p.boulder_pb ?? undefined,
    lead_grade: p.lead_grade,
    boulder_grade: p.boulder_grade,
  }));
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Personal Best Timeline</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" stroke="#3a2e22" tick={AXIS} />
          <YAxis yAxisId="lead" stroke={COBALT} tick={AXIS} width={36} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
          <YAxis yAxisId="boulder" orientation="right" stroke={RED} tick={AXIS} width={42}
            domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false}
            tickFormatter={(v) => `V${v}`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v, name, ctx) => {
              if (name === "LEAD PB") return [ctx.payload.lead_grade ?? v, "Lead"];
              if (name === "BOULDER PB") return [ctx.payload.boulder_grade ?? `V${v}`, "Boulder"];
              return [v, name];
            }} />
          <Legend wrapperStyle={{ fontFamily: "var(--font-banner)", fontSize: 11 }} />
          <Line yAxisId="lead" type="stepAfter" dataKey="lead_pb" name="LEAD PB" stroke={COBALT} strokeWidth={3} connectNulls
            dot={{ r: 4, fill: COBALT, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
          <Line yAxisId="boulder" type="stepAfter" dataKey="boulder_pb" name="BOULDER PB" stroke={RED} strokeWidth={3} connectNulls
            dot={{ r: 4, fill: RED, stroke: INK, strokeWidth: 2 }} activeDot={{ r: 6, stroke: INK, strokeWidth: 2 }} />
        </LineChart>
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
      <div style={{ marginBottom: 22 }}>
        <Ribbon color="var(--sea)" textColor="var(--cream)">★ PROGRESS ★</Ribbon>
      </div>
      <div className="gap-col">
        <PBTimeline points={data.pb_timeline} />
        <MoodVsSendRate rows={data.mood_vs_send_rate} />
        <LocationBreakdown rows={data.location_breakdown} />
        <AttemptsHistogram rows={data.attempts_histogram} />
        <LeadProgression onsight={data.lead_onsight_progression} flash={data.lead_flash_progression} redpoint={data.lead_redpoint_progression} />
        <LeadPyramid rows={data.lead_send_pyramid} />
        <BoulderPyramid rows={data.boulder_send_pyramid} />
        <ChartCard
          title="Limit Boulder Max Grade (Sends)"
          data={data.boulder_max_grade}
          color={SEA}
          yTickFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
          tooltipFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
        />
        <VolumeChart data={data.session_volume} />
        <ChartCard
          title="Send Rate (% sends per session)"
          data={data.send_rate}
          color="#e88aa3"
          yTickFormatter={(v) => `${v}%`}
          tooltipFormatter={(v) => `${v}%`}
        />
        <ChartCard
          title="Falls Trend (avg falls/route, lead only)"
          data={data.falls_trend}
          color={FLASH}
          yTickFormatter={(v) => `${v}`}
          tooltipFormatter={(v) => `${v} falls`}
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
