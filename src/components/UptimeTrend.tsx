import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface UptimeTrendProps {
  incidents: {
    startedAt: string;
    durationMinutes: number | null;
  }[];
  color: string;
  months: number;
}

function computeMonthlyUptime(
  incidents: UptimeTrendProps["incidents"],
  months: number
): { month: string; uptime: number }[] {
  const now = new Date();
  const data: { month: string; uptime: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const totalMinutes =
      (monthEnd.getTime() - d.getTime()) / 60000;

    const monthIncidents = incidents.filter((inc) => {
      const incDate = new Date(inc.startedAt);
      return (
        incDate.getFullYear() === d.getFullYear() &&
        incDate.getMonth() === d.getMonth() &&
        inc.durationMinutes !== null
      );
    });

    const downtime = monthIncidents.reduce(
      (sum, inc) => sum + (inc.durationMinutes ?? 0),
      0
    );

    data.push({
      month: d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      uptime: Number((((totalMinutes - downtime) / totalMinutes) * 100).toFixed(4)),
    });
  }

  return data;
}

export default function UptimeTrend({
  incidents,
  color,
  months = 12,
}: UptimeTrendProps) {
  const data = computeMonthlyUptime(incidents, months);

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Monthly Uptime — Last {months} Months
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis dataKey="month" tick={{ fill: "#8892a4", fontSize: 12 }} />
          <YAxis
            domain={[99, 100]}
            tick={{ fill: "#8892a4", fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, color: "#e2e8f0" }}
            formatter={(value: number) => [`${value.toFixed(4)}%`, "Uptime"]}
          />
          <Line
            type="monotone"
            dataKey="uptime"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
