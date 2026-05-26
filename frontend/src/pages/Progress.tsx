import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/client";
import type { ProgressData } from "../api/client";
import { format } from "date-fns";

const BOULDER_GRADES = [
  "V0","V1","V2","V3","V4","V5","V6","V7","V8","V9",
  "V10","V11","V12","V13","V14","V15","V16",
];

const YDS_GRADES = [
  "5.6","5.7","5.8","5.9",
  "5.10a","5.10b","5.10c","5.10d",
  "5.11a","5.11b","5.11c","5.11d",
  "5.12a","5.12b","5.12c","5.12d",
  "5.13a","5.13b","5.13c","5.13d",
  "5.14a","5.14b","5.14c","5.14d",
  "5.15a","5.15b","5.15c","5.15d",
];

const FRENCH_GRADES = [
  "5a","5b","5c",
  "6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+",
  "8a","8a+","8b","8b+","8c","8c+",
  "9a","9a+","9b","9b+","9c",
];

function ChartCard({
  title,
  data,
  color,
  yTickFormatter,
  tooltipFormatter,
}: {
  title: string;
  data: { date: string; value: number; label: string }[];
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

  const chartData = data.map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    value: p.value,
    label: p.label,
  }));

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{title}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3350" />
          <XAxis dataKey="date" stroke="#7880a0" tick={{ fontSize: 12 }} />
          <YAxis
            stroke="#7880a0"
            tick={{ fontSize: 12 }}
            tickFormatter={yTickFormatter}
            width={44}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
            labelStyle={{ color: "#e8eaf0" }}
            formatter={(v) => tooltipFormatter ? tooltipFormatter(v as number) : v}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={title}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    api.getProgress().then(setData);
  }, []);

  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1 style={{ marginBottom: 24 }}>Progress</h1>
      <div className="gap-col">
        {data.lead_max_grade_ewbank.length > 0 && (
          <ChartCard
            title="Lead — Max Grade (Ewbank, sends)"
            data={data.lead_max_grade_ewbank}
            color="#c084fc"
            yTickFormatter={(v) => String(Math.round(v + 1))}
            tooltipFormatter={(v) => String(Math.round(v + 1))}
          />
        )}
        {data.lead_max_grade_yds.length > 0 && (
          <ChartCard
            title="Lead — Max Grade (YDS, sends)"
            data={data.lead_max_grade_yds}
            color="#f97316"
            yTickFormatter={(v) => YDS_GRADES[v] ?? `5.?`}
            tooltipFormatter={(v) => YDS_GRADES[v] ?? `5.?`}
          />
        )}
        {data.lead_max_grade_french.length > 0 && (
          <ChartCard
            title="Lead — Max Grade (French, sends)"
            data={data.lead_max_grade_french}
            color="#f97316"
            yTickFormatter={(v) => FRENCH_GRADES[v] ?? `?`}
            tooltipFormatter={(v) => FRENCH_GRADES[v] ?? `?`}
          />
        )}
        <ChartCard
          title="Fingerboard Max Added Weight"
          data={data.fingerboard_max_weight}
          color="#5b8dee"
          yTickFormatter={(v) => `${v}kg`}
          tooltipFormatter={(v) => `${v} kg`}
        />
        <ChartCard
          title="Limit Boulder Max Grade (Sends)"
          data={data.boulder_max_grade}
          color="#3ecf8e"
          yTickFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
          tooltipFormatter={(v) => BOULDER_GRADES[v] ?? `V${v}`}
        />
        <ChartCard
          title="Strength Max Added Weight"
          data={data.strength_max_weight}
          color="#e0a85c"
          yTickFormatter={(v) => `${v}kg`}
          tooltipFormatter={(v) => `${v} kg`}
        />
      </div>
    </div>
  );
}
