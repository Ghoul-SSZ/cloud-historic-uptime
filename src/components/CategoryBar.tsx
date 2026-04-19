import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { CATEGORY_LABELS } from "../lib/data";
import { buildYAxisConfig } from "../lib/uptime";

interface CategoryBarProps {
  scores: Record<
    string,
    { byCategory: Record<string, Record<string, number>> }
  >;
  period: string;
  enabledProviders: Set<string>;
}

const CATEGORIES = [
  "compute",
  "storage",
  "networking",
  "database",
  "ai-ml",
  "security",
];

const PROVIDERS = [
  { key: "aws", label: "AWS", color: "#ff9900" },
  { key: "azure", label: "Azure", color: "#00a4ef" },
  { key: "gcp", label: "GCP", color: "#0f9d58" },
];

export default function CategoryBar({ scores, period, enabledProviders }: CategoryBarProps) {
  const active = PROVIDERS.filter((p) => enabledProviders.has(p.key));

  const data = CATEGORIES.map((cat) => {
    const row: Record<string, string | number> = { category: CATEGORY_LABELS[cat] ?? cat };
    for (const p of active) {
      row[p.label] = scores[p.key]?.byCategory?.[cat]?.[period] ?? 100;
    }
    return row;
  });

  const allValues = data.flatMap((d) =>
    active.map((p) => d[p.label] as number)
  );
  const minValue = Math.min(...allValues);
  const yAxis = buildYAxisConfig(minValue);

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Uptime by Category ({period})
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis dataKey="category" tick={{ fill: "#8892a4", fontSize: 12 }} />
          <YAxis
            domain={yAxis.domain}
            ticks={yAxis.ticks}
            tick={{ fill: "#8892a4", fontSize: 12 }}
            tickFormatter={yAxis.formatter}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, color: "#e2e8f0" }}
            formatter={(value: number) => [`${value.toFixed(4)}%`]}
          />
          <Legend wrapperStyle={{ color: "#8892a4", fontSize: "0.8rem" }} />
          {active.map((p) => (
            <Bar key={p.key} dataKey={p.label} fill={p.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
