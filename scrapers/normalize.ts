import type { Severity, Provider } from "./types";

export function mapGcpSeverity(raw: string): Severity {
  switch (raw.toLowerCase()) {
    case "high":
      return "critical";
    case "medium":
      return "major";
    case "low":
      return "minor";
    default:
      return "minor";
  }
}

export function mapAwsSeverity(status: number): Severity {
  switch (status) {
    case 3:
      return "critical";
    case 2:
      return "major";
    default:
      return "minor";
  }
}

const CRITICAL_KEYWORDS = [
  "outage",
  "down",
  "unavailable",
  "widespread",
  "complete failure",
];
const MAJOR_KEYWORDS = [
  "degradation",
  "degraded",
  "elevated errors",
  "partial",
  "disruption",
];

export function inferAzureSeverity(
  text: string,
  affectedServiceCount: number
): Severity {
  const lower = text.toLowerCase();

  if (CRITICAL_KEYWORDS.some((kw) => lower.includes(kw))) return "critical";
  if (
    MAJOR_KEYWORDS.some((kw) => lower.includes(kw)) ||
    affectedServiceCount >= 3
  )
    return "major";
  return "minor";
}

export function computeDurationMinutes(
  startedAt: string,
  resolvedAt: string | null
): number | null {
  if (!resolvedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(resolvedAt).getTime();
  return Math.round((end - start) / 60000);
}

export function makeIncidentId(provider: Provider, rawId: string): string {
  return `${provider}-${rawId}`;
}
