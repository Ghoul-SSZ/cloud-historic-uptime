import { useState } from "react";
import CategoryBar from "./CategoryBar";
import UptimeTrendCompare from "./UptimeTrendCompare";
import { PERIODS, PERIOD_TO_MONTHS } from "../lib/data";

interface ProviderMeta {
  name: string;
  color: string;
  statusUrl: string;
}

interface IncidentData {
  startedAt: string;
  durationMinutes: number | null;
}

interface CoverageInfo {
  count: number;
  earliest: string | null;
  source: string;
}

interface CompareSectionProps {
  scores: Record<
    string,
    {
      overall: Record<string, number>;
      byCategory: Record<string, Record<string, number>>;
    }
  >;
  providerMeta: Record<string, ProviderMeta>;
  incidentsByProvider: Record<string, IncidentData[]>;
  coverageByProvider: Record<string, CoverageInfo>;
}

const HEAD_TO_HEAD = [
  {
    category: "Compute",
    key: "compute",
    services: [
      { provider: "aws", name: "Amazon EC2" },
      { provider: "azure", name: "Azure Virtual Machines" },
      { provider: "gcp", name: "Compute Engine" },
    ],
  },
  {
    category: "Storage",
    key: "storage",
    services: [
      { provider: "aws", name: "Amazon S3" },
      { provider: "azure", name: "Blob Storage" },
      { provider: "gcp", name: "Cloud Storage" },
    ],
  },
  {
    category: "Database",
    key: "database",
    services: [
      { provider: "aws", name: "Amazon RDS" },
      { provider: "azure", name: "Azure SQL Database" },
      { provider: "gcp", name: "Cloud SQL" },
    ],
  },
  {
    category: "Networking",
    key: "networking",
    services: [
      { provider: "aws", name: "Amazon VPC" },
      { provider: "azure", name: "Azure Virtual Network" },
      { provider: "gcp", name: "Cloud VPC" },
    ],
  },
  {
    category: "AI/ML",
    key: "ai-ml",
    services: [
      { provider: "aws", name: "Amazon SageMaker" },
      { provider: "azure", name: "Azure AI" },
      { provider: "gcp", name: "Vertex AI" },
    ],
  },
];

function scoreColor(val: number | undefined): string {
  if (val === undefined) return "#8892a4";
  if (val >= 99.95) return "#10b981";
  if (val >= 99.9) return "#f59e0b";
  return "#ef4444";
}

function coverageLabel(earliest: string | null): string {
  if (!earliest) return "No data";
  const start = new Date(earliest);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMonths = Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000));
  if (diffMonths < 12) return `~${diffMonths}mo history`;
  const years = (diffMonths / 12).toFixed(1).replace(/\.0$/, "");
  return `~${years}yr history`;
}

export default function CompareSection({
  scores,
  providerMeta,
  incidentsByProvider,
  coverageByProvider,
}: CompareSectionProps) {
  const allProviders = Object.keys(providerMeta);
  const [period, setPeriod] = useState("90d");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(allProviders));

  function toggleProvider(provider: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(provider) && next.size > 1) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;
  const months = PERIOD_TO_MONTHS[period] ?? 6;

  return (
    <>
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

      {/* Data coverage badges (clickable toggles) */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        {Object.entries(coverageByProvider).map(([provider, cov]) => {
          const meta = providerMeta[provider];
          const active = enabled.has(provider);
          return (
            <button
              key={provider}
              onClick={() => toggleProvider(provider)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: active ? "#1a1d2e" : "#12141f",
                border: active ? `1px solid ${meta?.color ?? "#2a2d3e"}` : "1px solid #2a2d3e",
                borderRadius: 6,
                padding: "0.35rem 0.75rem",
                fontSize: "0.75rem",
                cursor: "pointer",
                opacity: active ? 1 : 0.4,
                transition: "opacity 0.15s, border-color 0.15s",
              }}
            >
              <span style={{ color: meta?.color ?? "#e2e8f0", fontWeight: 600 }}>
                {meta?.name ?? provider}
              </span>
              <span style={{ color: "#8892a4" }}>
                {cov.count} incidents · {coverageLabel(cov.earliest)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Collapsible data source disclosure */}
      <div style={{ marginBottom: "1.5rem" }}>
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
            <p style={{ margin: "0 0 0.75rem" }}>
              Each cloud provider publishes incident data differently, which affects how comparable the numbers are across longer time windows:
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {Object.entries(coverageByProvider).map(([provider, cov]) => {
                const meta = providerMeta[provider];
                return (
                  <li key={provider} style={{ marginBottom: "0.4rem" }}>
                    <strong style={{ color: meta?.color ?? "#e2e8f0" }}>{meta?.name ?? provider}</strong>
                    {" — "}
                    {cov.source}
                    {cov.earliest && ` (data from ${cov.earliest})`}
                  </li>
                );
              })}
            </ul>
            <p style={{ margin: "0.75rem 0 0" }}>
              GCP reports significantly more incidents because their status pages capture granular per-product events including minor degradations. AWS and Azure expose fewer historical records through their public APIs. Short time windows (30d, 90d) provide the most balanced comparison.
            </p>
            <p style={{ margin: "0.5rem 0 0" }}>
              Each incident's downtime contribution is capped at 24 hours. Long-running tracked issues (e.g., multi-week known issues) are not continuous outages and would otherwise skew the numbers. Overlapping incidents are merged so concurrent outages are not double-counted.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <CategoryBar scores={scores} period={period} enabledProviders={enabled} />
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <UptimeTrendCompare
          incidentsByProvider={incidentsByProvider}
          providerMeta={providerMeta}
          months={months}
          enabledProviders={enabled}
        />
      </div>

      <h2
        style={{
          fontSize: "1.1rem",
          marginBottom: "1.25rem",
          color: "#e2e8f0",
        }}
      >
        Head-to-Head
      </h2>

      {HEAD_TO_HEAD.map((matchup) => (
        <div key={matchup.key} style={{ marginBottom: "1.5rem" }}>
          <h3
            style={{
              fontSize: "0.95rem",
              marginBottom: "0.75rem",
              color: "#8892a4",
            }}
          >
            {matchup.category}
          </h3>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            {matchup.services.filter((svc) => enabled.has(svc.provider)).map((svc) => {
              const meta = providerMeta[svc.provider];
              const val =
                scores[svc.provider]?.byCategory?.[matchup.key]?.[period];
              return (
                <div
                  key={svc.provider}
                  style={{
                    flex: 1,
                    minWidth: 150,
                    background: "#1a1d2e",
                    border: "1px solid #2a2d3e",
                    borderRadius: 8,
                    padding: "1rem",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.5rem",
                      color: meta?.color ?? "#e2e8f0",
                    }}
                  >
                    {svc.name}
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: scoreColor(val),
                    }}
                  >
                    {val !== undefined ? `${val.toFixed(2)}%` : "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#8892a4",
                      marginTop: "0.25rem",
                    }}
                  >
                    {periodLabel} uptime
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
