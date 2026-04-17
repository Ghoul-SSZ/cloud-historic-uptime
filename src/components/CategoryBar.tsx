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

interface CategoryBarProps {
  scores: Record<
    string,
    { byCategory: Record<string, Record<string, number>> }
  >;
  period: string;
}

const CATEGORIES = [
  "compute",
  "storage",
  "networking",
  "database",
  "ai-ml",
  "security",
];

export default function CategoryBar({ scores, period }: CategoryBarProps) {
  const data = CATEGORIES.map((cat) => ({
    category: cat,
    AWS: scores.aws?.byCategory?.[cat]?.[period] ?? 100,
    Azure: scores.azure?.byCategory?.[cat]?.[period] ?? 100,
    GCP: scores.gcp?.byCategory?.[cat]?.[period] ?? 100,
  }));

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
            domain={[99, 100]}
            tick={{ fill: "#8892a4", fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, color: "#e2e8f0" }}
            formatter={(value: number) => [`${value.toFixed(4)}%`]}
          />
          <Legend wrapperStyle={{ color: "#8892a4", fontSize: "0.8rem" }} />
          <Bar dataKey="AWS" fill="#ff9900" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Azure" fill="#0078d4" radius={[2, 2, 0, 0]} />
          <Bar dataKey="GCP" fill="#4285f4" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
