import { useState } from "react";
import UptimeTrend from "./UptimeTrend";
import { PERIODS, PERIOD_TO_MONTHS, CATEGORY_LABELS } from "../lib/data";

interface IncidentData {
  startedAt: string;
  durationMinutes: number | null;
}

interface ProviderSectionProps {
  incidents: IncidentData[];
  color: string;
  overallScores: Record<string, number>;
  categoryScores: Record<string, Record<string, number>>;
  dataSource: string;
  dataFrom: string | null;
}

const CATEGORIES = [
  "compute", "storage", "networking", "database", "ai-ml",
  "security", "analytics", "devtools", "messaging", "management",
];

function scoreColor(val: number | undefined): string {
  if (val === undefined) return "#8892a4";
  if (val >= 99.95) return "#10b981";
  if (val >= 99.9) return "#f59e0b";
  return "#ef4444";
}

export default function ProviderSection({
  incidents,
  color,
  overallScores,
  categoryScores,
  dataSource,
  dataFrom,
}: ProviderSectionProps) {
  const [period, setPeriod] = useState("90d");
  const [aboutOpen, setAboutOpen] = useState(false);
  const months = PERIOD_TO_MONTHS[period] ?? 6;
  const overallVal = overallScores?.[period];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  return (
    <>
      {/* Overall uptime headline */}
      <div
        style={{
          background: "#1a1d2e",
          border: "1px solid #2a2d3e",
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.8rem", color: "#8892a4", marginBottom: "0.35rem" }}>
          Overall Uptime ({periodLabel})
        </div>
        <div
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: scoreColor(overallVal),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {overallVal !== undefined ? `${overallVal.toFixed(3)}%` : "—"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <label
          htmlFor="period-select"
          style={{ color: "#8892a4", fontSize: "0.85rem" }}
        >
          Time window:
        </label>
        <select
          id="period-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            background: "#1a1d2e",
            color: "#e2e8f0",
            border: "1px solid #2a2d3e",
            borderRadius: 6,
            padding: "0.4rem 0.75rem",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <UptimeTrend incidents={incidents} color={color} months={months} />
      </div>

      <div
        style={{
          background: "#1a1d2e",
          border: "1px solid #2a2d3e",
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ fontSize: "0.95rem", marginBottom: "1rem", color: "#e2e8f0" }}>
          Uptime by Category ({PERIODS.find((p) => p.value === period)?.label ?? period})
        </h3>
        <div style={{ fontSize: "0.85rem" }}>
          {CATEGORIES.map((cat) => {
            const val = categoryScores?.[cat]?.[period];
            return (
              <div
                key={cat}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid #2a2d3e",
                }}
              >
                <span style={{ color: "#8892a4" }}>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: scoreColor(val),
                  }}
                >
                  {val !== undefined ? `${val.toFixed(2)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible data source disclosure */}
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={() => setAboutOpen(!aboutOpen)}
          style={{
            background: "none",
            border: "none",
            color: "#b0b8c8",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            padding: "0.3rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{
            display: "inline-block",
            transition: "transform 0.15s",
            transform: aboutOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            &#9654;
          </span>
          About this data
        </button>
        {aboutOpen && (
          <div
            style={{
              marginTop: "0.75rem",
              background: "#1a1d2e",
              border: "1px solid #2a2d3e",
              borderRadius: 8,
              padding: "1rem 1.25rem",
              fontSize: "0.8rem",
              lineHeight: 1.6,
              color: "#8892a4",
            }}
          >
            <p style={{ margin: "0 0 0.5rem" }}>
              <strong style={{ color: "#e2e8f0" }}>Source:</strong> {dataSource}
              {dataFrom && ` (data from ${dataFrom})`}
            </p>
            <p style={{ margin: "0 0 0.5rem" }}>
              <strong style={{ color: "#e2e8f0" }}>Incidents:</strong> {incidents.length} total
            </p>
            <p style={{ margin: 0 }}>
              Each incident's downtime contribution is capped at 24 hours. Long-running tracked issues (e.g., multi-week known issues) are not continuous outages and would otherwise skew the numbers. Overlapping incidents are merged so concurrent outages are not double-counted.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
