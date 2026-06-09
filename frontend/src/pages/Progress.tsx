import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ScatterChart, Scatter,
} from "recharts";
import { api } from "../api/client";
import type {
  ProgressData, ProgressPoint, ProgressRange, LeadPyramidRow, BoulderPyramidRow,
  MoodSendRatePoint, LocationBreakdownRow, AttemptsHistogramRow, PBTimelinePoint,
  DailyActivity, SessionIntensity,
} from "../api/client";
import { format, subDays, startOfWeek, eachDayOfInterval } from "date-fns";
import { Link } from "react-router-dom";
import type { SendDetail } from "../api/client";
import { Ribbon } from "../ui";
import { onKey } from "../lib/a11y";

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

/** Least-squares slope+intercept over y-values at x = 0..n-1. */
function linearFit(ys: number[]): { slope: number; intercept: number } {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function ChartCard({
  title, data, color, yTickFormatter, tooltipFormatter, projection,
}: {
  title: string;
  data: ProgressPoint[];
  color: string;
  yTickFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number) => string;
  projection?: boolean;   // overlay a dotted linear-trend line
}) {
  if (data.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>{title}</div>
        <p className="muted" style={{ fontSize: 13 }}>No data yet — log some sessions to see progress.</p>
      </div>
    );
  }
  const showTrend = projection === true && data.length >= 3;
  const fit = showTrend ? linearFit(data.map((p) => p.value)) : null;
  const chartData = data.map((p, i) => ({
    date: format(new Date(p.date), "MMM d"),
    value: p.value,
    ...(fit ? { trend: Math.round((fit.intercept + fit.slope * i) * 10) / 10 } : {}),
  }));
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" stroke="#3a2e22" tick={AXIS} />
          <YAxis stroke="#3a2e22" tick={AXIS} tickFormatter={yTickFormatter} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
            formatter={(v, name) => [
              tooltipFormatter ? tooltipFormatter(v as number) : v,
              name === "TREND" ? "Trend" : "Actual",
            ]} />
          {showTrend && (
            <Line type="linear" dataKey="trend" name="TREND" stroke={INK} strokeWidth={2}
              strokeDasharray="5 4" dot={false} activeDot={false} />
          )}
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
function LeadPyramid({ rows, onPick }: { rows: LeadPyramidRow[]; onPick: (grade: string) => void }) {
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
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={6}
          onClick={(e) => { const g = e?.activeLabel; if (g) onPick(String(g)); }} style={{ cursor: "pointer" }}>
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
      <p className="muted" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Tap a grade to see those sends.</p>
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
function BoulderPyramid({ rows, onPick }: { rows: BoulderPyramidRow[]; onPick: (grade: string) => void }) {
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
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={6}
          onClick={(e) => { const g = e?.activeLabel; if (g) onPick(String(g)); }} style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke="#3a2e22" tick={AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey="grade" stroke="#3a2e22" tick={AXIS} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }} />
          <Legend wrapperStyle={{ fontFamily: "var(--font-banner)", fontSize: 11 }} />
          <Bar dataKey="flash" name="FLASH" stackId="a" fill={FLASH} stroke={INK} strokeWidth={2} />
          <Bar dataKey="send" name="SEND" stackId="a" fill={SEA} stroke={INK} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
      <p className="muted" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Tap a grade to see those sends.</p>
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

/** Days back to render in the heatmap for each range (snapped to whole weeks). */
const HEATMAP_WINDOW: Record<ProgressRange, number> = {
  "6w": 42, "6mo": 182, "1y": 365, "all": 0, // "all" derives from earliest activity
};

// Sea ramp, faint → full. Index 0 is an empty (no-tick) day.
const HEAT_SHADES = ["transparent", "#cfe3dc", "#8fc4b5", "#4d9d88", "#2d8a73"];

function heatLevel(ticks: number): number {
  if (ticks <= 0) return 0;
  if (ticks <= 2) return 1;
  if (ticks <= 5) return 2;
  if (ticks <= 9) return 3;
  return 4;
}

/** GitHub-style contribution calendar — one cell per day, intensity = tick volume. */
function ContributionHeatmap({ daily, range }: { daily: DailyActivity[]; range: ProgressRange }) {
  if (daily.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Activity Heatmap</div>
        <p className="muted" style={{ fontSize: 13 }}>No climbing days in this range yet.</p>
      </div>
    );
  }

  const byDate = new Map(daily.map((d) => [d.date, d.ticks]));
  const today = new Date();
  const earliest = new Date(daily[0].date);
  const rawStart = range === "all" ? earliest : subDays(today, HEATMAP_WINDOW[range] - 1);
  const start = startOfWeek(rawStart, { weekStartsOn: 0 }); // align columns to weeks (Sun)
  const days = eachDayOfInterval({ start, end: today });

  // Group into week columns of 7 (Sun..Sat).
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const CELL = 12, GAP = 3;
  return (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>Activity Heatmap (ticks per day)</div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: GAP, width: "max-content" }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const ticks = byDate.get(key) ?? 0;
                const future = day > today;
                const level = heatLevel(ticks);
                return (
                  <div
                    key={key}
                    title={future ? "" : `${format(day, "EEE MMM d")} · ${ticks} tick${ticks === 1 ? "" : "s"}`}
                    style={{
                      width: CELL, height: CELL,
                      background: future ? "transparent" : HEAT_SHADES[level],
                      border: level === 0 ? "1px solid rgba(26,22,18,0.12)" : "1px solid rgba(26,22,18,0.35)",
                      opacity: future ? 0 : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="gap-row" style={{ gap: 5, marginTop: 10, alignItems: "center", justifyContent: "flex-end" }}>
        <span className="muted" style={{ fontSize: 10, fontFamily: "var(--font-banner)", letterSpacing: "0.06em" }}>LESS</span>
        {HEAT_SHADES.map((c, i) => (
          <div key={i} style={{
            width: 11, height: 11, background: i === 0 ? "transparent" : c,
            border: i === 0 ? "1px solid rgba(26,22,18,0.12)" : "1px solid rgba(26,22,18,0.35)",
          }} />
        ))}
        <span className="muted" style={{ fontSize: 10, fontFamily: "var(--font-banner)", letterSpacing: "0.06em" }}>MORE</span>
      </div>
    </div>
  );
}

/** Volume vs intensity scatter — one dot per session, x = ticks, y = hardest send. */
function VolumeIntensityScatter({ rows }: { rows: SessionIntensity[] }) {
  const boulderPts = rows
    .filter((r) => r.hardest_boulder != null)
    .map((r) => ({ ticks: r.total_ticks, grade: r.hardest_boulder!, label: r.hardest_boulder_label, date: r.date }));
  const leadPts = rows
    .filter((r) => r.hardest_lead != null)
    .map((r) => ({ ticks: r.total_ticks, grade: r.hardest_lead!, label: r.hardest_lead_label, date: r.date }));

  if (boulderPts.length === 0 && leadPts.length === 0) {
    return (
      <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
        <div style={CHART_TITLE_STYLE}>Volume vs Intensity</div>
        <p className="muted" style={{ fontSize: 13 }}>Log sessions with sends to see junk-volume vs quality days.</p>
      </div>
    );
  }

  type Pt = { ticks: number; grade: number; label?: string | null; date: string };
  const scatterCard = (title: string, pts: Pt[], color: string, yFmt: (v: number) => string) => (
    <div className={CHART_CARD_CLS} style={{ padding: 16 }}>
      <div style={CHART_TITLE_STYLE}>{title}</div>
      {pts.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No sends in this range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis type="number" dataKey="ticks" name="Ticks" stroke="#3a2e22" tick={AXIS}
              allowDecimals={false} label={{ value: "TICKS", position: "insideBottomRight", offset: -6, fontSize: 10, fontFamily: "var(--font-banner)" }} />
            <YAxis type="number" dataKey="grade" name="Grade" stroke="#3a2e22" tick={AXIS} width={44}
              allowDecimals={false} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={yFmt} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: INK, fontWeight: 700 }}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v, name, ctx) => {
                if (name === "Grade") return [ctx.payload.label ?? yFmt(v as number), "Hardest"];
                return [v, "Ticks"];
              }}
              labelFormatter={() => ""} />
            <Scatter data={pts} fill={color} stroke={INK} strokeWidth={2} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <>
      {scatterCard("Boulder — Volume vs Intensity", boulderPts, SEA, (v) => BOULDER_GRADES[v] ?? `V${v}`)}
      {scatterCard("Lead — Volume vs Intensity (Ewbank)", leadPts, COBALT, (v) => String(v))}
    </>
  );
}

const SEND_TYPE_LABEL: Record<string, string> = {
  onsight: "ONSIGHT", flash: "FLASH", redpoint: "REDPOINT", pinkpoint: "PINKPOINT",
};

/** Bottom-sheet listing the individual sends behind a tapped pyramid bar. */
function DrillDownSheet({
  title, grade, sends, onClose,
}: {
  title: string; grade: string; sends: SendDetail[]; onClose: () => void;
}) {
  const forGrade = sends.filter((s) => s.grade === grade);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50, background: "rgba(26,22,18,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="paper-plain"
        style={{
          width: "100%", maxWidth: 480, maxHeight: "75vh", overflowY: "auto",
          border: "var(--bw) solid var(--ink)", boxShadow: "0 -6px 0 var(--ink)",
          padding: "18px 16px 28px", borderRadius: "12px 12px 0 0",
        }}
      >
        <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 13, letterSpacing: "0.08em" }}>
            {title} · {grade} <span className="muted">({forGrade.length})</span>
          </div>
          <div role="button" tabIndex={0} onClick={onClose} onKeyDown={onKey(onClose)}
            style={{
              fontFamily: "var(--font-banner)", fontSize: 11, padding: "4px 10px", cursor: "pointer",
              border: "var(--b) solid var(--ink)", background: "var(--red)", color: "var(--cream)",
            }}>✕ CLOSE</div>
        </div>
        <div className="gap-col">
          {forGrade.map((s, i) => (
            <Link key={i} to={`/sessions/${s.session_id}`} style={{ textDecoration: "none" }}>
              <div className="card-flat offset-ink" style={{ padding: "10px 13px", cursor: "pointer" }}>
                <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
                    color: "var(--cream)", background: "var(--sea)", padding: "2px 7px",
                    border: "var(--b) solid var(--ink)",
                  }}>{SEND_TYPE_LABEL[s.send_type] ?? s.send_type.toUpperCase()}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{format(new Date(s.date), "MMM d yyyy")}</span>
                </div>
                {(s.route_name || s.attempts != null) && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
                    {s.route_name && <span>{s.route_name}</span>}
                    {s.route_name && s.attempts != null && <span> · </span>}
                    {s.attempts != null && <span>{s.attempts} attempt{s.attempts === 1 ? "" : "s"}</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const RANGES: { key: ProgressRange; label: string }[] = [
  { key: "6w", label: "6W" },
  { key: "6mo", label: "6MO" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "ALL" },
];

function RangeChips({ value, onChange }: { value: ProgressRange; onChange: (r: ProgressRange) => void }) {
  return (
    <div className="gap-row" style={{ gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {RANGES.map(({ key, label }) => {
        const active = key === value;
        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            onClick={() => onChange(key)}
            onKeyDown={onKey(() => onChange(key))}
            style={{
              padding: "6px 14px", cursor: "pointer",
              fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
              border: "var(--b) solid var(--ink)",
              color: active ? "var(--cream)" : "var(--ink)",
              background: active ? "var(--sea)" : "transparent",
              boxShadow: active ? "2px 2px 0 var(--ink)" : "none",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [range, setRange] = useState<ProgressRange>("all");
  const [loading, setLoading] = useState(true);
  // Pyramid drill-down selection: which discipline + grade to expand.
  const [drill, setDrill] = useState<{ kind: "lead" | "boulder"; grade: string } | null>(null);

  // Set loading in the handler (not the effect) so we never call setState
  // synchronously inside useEffect.
  function changeRange(r: ProgressRange) {
    if (r === range) return;
    setLoading(true);
    setRange(r);
  }

  useEffect(() => {
    api.getProgress(range).then(setData).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="page">
      <div style={{ marginBottom: 22 }}>
        <Ribbon color="var(--sea)" textColor="var(--cream)">★ PROGRESS ★</Ribbon>
      </div>
      <RangeChips value={range} onChange={changeRange} />

      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
      <div className="gap-col" style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s" }}>
        <ContributionHeatmap daily={data.daily_activity} range={range} />
        <PBTimeline points={data.pb_timeline} />
        <VolumeIntensityScatter rows={data.session_intensity} />
        <MoodVsSendRate rows={data.mood_vs_send_rate} />
        <LocationBreakdown rows={data.location_breakdown} />
        <AttemptsHistogram rows={data.attempts_histogram} />
        <LeadProgression onsight={data.lead_onsight_progression} flash={data.lead_flash_progression} redpoint={data.lead_redpoint_progression} />
        <LeadPyramid rows={data.lead_send_pyramid} onPick={(grade) => setDrill({ kind: "lead", grade })} />
        <BoulderPyramid rows={data.boulder_send_pyramid} onPick={(grade) => setDrill({ kind: "boulder", grade })} />
        <ChartCard
          title="Limit Boulder Max Grade (Sends)"
          data={data.boulder_max_grade}
          color={SEA}
          projection
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
      )}

      {drill && data && (
        <DrillDownSheet
          title={drill.kind === "lead" ? "Lead sends" : "Boulder sends"}
          grade={drill.grade}
          sends={drill.kind === "lead" ? data.lead_sends : data.boulder_sends}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
