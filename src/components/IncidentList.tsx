import { useState, useMemo } from "react";

interface Incident {
  id: string;
  title: string;
  severity: string;
  startedAt: string;
  durationMinutes: number | null;
  affectedServices: { serviceName: string; category: string }[];
}

interface IncidentListProps {
  incidents: Incident[];
  baseUrl: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  minor: "#f59e0b",
  major: "#ea580c",
  critical: "#ef4444",
};

export default function IncidentList({ incidents, baseUrl }: IncidentListProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    incidents.forEach((inc) =>
      inc.affectedServices.forEach((svc) => cats.add(svc.category))
    );
    return Array.from(cats).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (severityFilter !== "all" && inc.severity !== severityFilter) return false;
      if (
        categoryFilter !== "all" &&
        !inc.affectedServices.some((svc) => svc.category === categoryFilter)
      )
        return false;
      return true;
    });
  }, [incidents, categoryFilter, severityFilter]);

  const selectStyle: React.CSSProperties = {
    background: "#0f1117",
    color: "#e2e8f0",
    border: "1px solid #2a2d3e",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: "0.8rem",
  };

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", margin: 0 }}>
          Incident History ({filtered.length})
        </h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="all">All severities</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        {filtered.map((inc) => (
          <a
            key={inc.id}
            href={`${baseUrl}incident/${inc.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.6rem 0",
              borderBottom: "1px solid #2a2d3e",
              textDecoration: "none",
              color: "#e2e8f0",
              fontSize: "0.85rem",
              flexWrap: "wrap",
              gap: "0.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: SEVERITY_COLORS[inc.severity] ?? "#888",
                flexShrink: 0,
              }} />
              <span>{inc.title}</span>
            </div>
            <span style={{ color: "#8892a4", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              {new Date(inc.startedAt).toLocaleDateString()}
              {inc.durationMinutes !== null && ` · ${inc.durationMinutes < 60 ? `${inc.durationMinutes}min` : `${Math.floor(inc.durationMinutes / 60)}h ${inc.durationMinutes % 60}min`}`}
            </span>
          </a>
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: "center", color: "#8892a4", padding: "1.5rem", fontSize: "0.85rem" }}>
            No incidents match the current filters.
          </p>
        )}
      </div>
    </div>
  );
}
