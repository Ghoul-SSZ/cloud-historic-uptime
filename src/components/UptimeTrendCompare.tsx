import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { mergedDowntimeMinutes, buildYAxisConfig } from "../lib/uptime";

interface IncidentData {
  startedAt: string;
  durationMinutes: number | null;
}

interface ProviderMeta {
  name: string;
  color: string;
  statusUrl: string;
}

interface UptimeTrendCompareProps {
  incidentsByProvider: Record<string, IncidentData[]>;
  providerMeta: Record<string, ProviderMeta>;
  months: number;
  enabledProviders: Set<string>;
}

function computeMonthlyUptime(
  incidents: IncidentData[],
  months: number
): { month: string; uptime: number }[] {
  const now = new Date();
  const data: { month: string; uptime: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const totalMinutes = (monthEnd.getTime() - d.getTime()) / 60000;

    const monthIncidents = incidents.filter((inc) => {
      const incDate = new Date(inc.startedAt);
      return (
        incDate.getFullYear() === d.getFullYear() &&
        incDate.getMonth() === d.getMonth() &&
        inc.durationMinutes !== null
      );
    });

    const downtime = mergedDowntimeMinutes(monthIncidents);

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

export default function UptimeTrendCompare({
  incidentsByProvider,
  providerMeta,
  months = 12,
  enabledProviders,
}: UptimeTrendCompareProps) {
  const providers = Object.keys(incidentsByProvider).filter((p) => enabledProviders.has(p));
  const uptimeByProvider: Record<string, { month: string; uptime: number }[]> = {};

  for (const provider of providers) {
    uptimeByProvider[provider] = computeMonthlyUptime(
      incidentsByProvider[provider],
      months
    );
  }

  // Merge into single data array keyed by month
  const data = uptimeByProvider[providers[0]]?.map((entry, idx) => {
    const row: Record<string, string | number> = { month: entry.month };
    for (const provider of providers) {
      const meta = providerMeta[provider];
      row[meta?.name ?? provider] = uptimeByProvider[provider][idx].uptime;
    }
    return row;
  }) ?? [];

  // Dynamic Y-axis domain
  const allValues = data.flatMap((d) =>
    providers.map((p) => d[providerMeta[p]?.name ?? p] as number)
  );
  const minValue = Math.min(...allValues);
  const yAxis = buildYAxisConfig(minValue);

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Monthly Uptime — Last {months} Months
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis dataKey="month" tick={{ fill: "#8892a4", fontSize: 12 }} />
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
          {providers.map((provider) => {
            const meta = providerMeta[provider];
            return (
              <Line
                key={provider}
                type="monotone"
                dataKey={meta?.name ?? provider}
                stroke={meta?.color ?? "#8892a4"}
                strokeWidth={2}
                dot={{ fill: meta?.color ?? "#8892a4", r: 3 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
