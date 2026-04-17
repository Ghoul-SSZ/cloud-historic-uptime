import type { ReactElement } from "react";

interface HeatmapProps {
  incidents: {
    provider: string;
    startedAt: string;
    severity: string;
  }[];
  weeks: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  clean: "#064e3b",
  minor: "#f59e0b",
  major: "#ea580c",
  critical: "#ef4444",
};

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  aws: { label: "AWS", color: "#ff9900" },
  azure: { label: "Azure", color: "#0078d4" },
  gcp: { label: "GCP", color: "#4285f4" },
};

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function buildWeekGrid(
  incidents: HeatmapProps["incidents"],
  weeks: number,
  provider: string
): { key: string; severity: string }[] {
  const now = new Date();
  const grid: { key: string; severity: string }[] = [];

  const providerIncidents = incidents.filter(
    (inc) => inc.provider === provider
  );
  const worstByWeek = new Map<string, string>();

  for (const inc of providerIncidents) {
    const key = getWeekKey(new Date(inc.startedAt));
    const current = worstByWeek.get(key);
    if (
      !current ||
      severityRank(inc.severity) > severityRank(current)
    ) {
      worstByWeek.set(key, inc.severity);
    }
  }

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = getWeekKey(d);
    grid.push({ key, severity: worstByWeek.get(key) ?? "clean" });
  }

  return grid;
}

function severityRank(s: string): number {
  switch (s) {
    case "critical": return 3;
    case "major": return 2;
    case "minor": return 1;
    default: return 0;
  }
}

export default function Heatmap({
  incidents,
  weeks = 52,
}: HeatmapProps): ReactElement {
  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Incident Heatmap — Last {weeks} Weeks
      </h3>
      {(["aws", "azure", "gcp"] as const).map((provider) => {
        const grid = buildWeekGrid(incidents, weeks, provider);
        const meta = PROVIDER_LABELS[provider];
        return (
          <div key={provider} style={{ marginBottom: "0.75rem" }}>
            <div style={{ color: meta.color, fontSize: "0.75rem", marginBottom: 4 }}>
              {meta.label}
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {grid.map((cell, i) => (
                <div
                  key={i}
                  title={`${cell.key}: ${cell.severity}`}
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 2,
                    background: SEVERITY_COLORS[cell.severity],
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.7rem", color: "#8892a4" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.clean, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          No incidents
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.minor, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Minor
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.major, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Major
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.critical, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Critical
        </span>
      </div>
    </div>
  );
}
