import type { GcpRawIncident, Incident } from "./types";
import { lookupCategory } from "./service-map";
import {
  mapGcpSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const GCP_INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";

export async function fetchGcpIncidents(): Promise<Incident[]> {
  const response = await fetch(GCP_INCIDENTS_URL);
  const raw: GcpRawIncident[] = await response.json();
  return raw.map(normalizeGcpIncident);
}

function normalizeGcpIncident(raw: GcpRawIncident): Incident {
  const resolvedAt = raw.end || null;
  return {
    id: makeIncidentId("gcp", raw.id),
    provider: "gcp",
    title: raw.external_desc,
    description: raw.updates.at(-1)?.text ?? raw.external_desc,
    severity: mapGcpSeverity(raw.severity),
    status: resolvedAt ? "resolved" : "ongoing",
    startedAt: raw.begin,
    resolvedAt,
    durationMinutes: computeDurationMinutes(raw.begin, resolvedAt),
    affectedServices: raw.affected_products.map((p) => ({
      serviceName: p.title,
      category: lookupCategory("gcp", p.title),
      regions: [],
    })),
    updates: raw.updates.map((u) => ({
      timestamp: u.when,
      status: u.status,
      message: u.text,
    })),
    sourceUrl: `https://status.cloud.google.com/incidents/${raw.id}`,
  };
}
