import type {
  Incident,
  Provider,
  ServiceCategory,
  UptimeScores,
} from "./types";

const PROVIDERS: Provider[] = ["aws", "azure", "gcp"];
const CATEGORIES: ServiceCategory[] = [
  "compute",
  "storage",
  "networking",
  "database",
  "ai-ml",
  "security",
  "analytics",
  "devtools",
  "messaging",
  "management",
  "other",
];
const WINDOWS: { label: string; days: number }[] = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "ytd", days: -1 }, // computed dynamically
  { label: "365d", days: 365 },
  { label: "2y", days: 730 },
  { label: "3y", days: 1095 },
  { label: "5y", days: 1825 },
];

// Cap each incident's downtime contribution — multi-week "known issues" are
// tracked as incidents but aren't continuous full outages.
const MAX_INCIDENT_MINUTES = 24 * 60; // 24 hours

/** Merge overlapping time intervals and return total non-overlapping minutes */
function mergedDowntimeMinutes(incidents: Incident[]): number {
  const intervals = incidents
    .map((inc) => {
      const start = new Date(inc.startedAt).getTime();
      const duration = Math.min(inc.durationMinutes ?? 0, MAX_INCIDENT_MINUTES);
      return { start, end: start + duration * 60000 };
    })
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let curEnd = -Infinity;

  for (const { start, end } of intervals) {
    if (start >= curEnd) {
      // no overlap — add full interval
      total += end - start;
      curEnd = end;
    } else if (end > curEnd) {
      // partial overlap — add only the extension
      total += end - curEnd;
      curEnd = end;
    }
    // fully contained — skip
  }

  return total / 60000;
}

export function computeUptimeScores(
  incidents: Incident[],
  endDate: Date = new Date()
): UptimeScores {
  const providers: UptimeScores["providers"] = {} as UptimeScores["providers"];

  for (const provider of PROVIDERS) {
    const providerIncidents = incidents.filter(
      (inc) => inc.provider === provider && inc.durationMinutes !== null
    );

    const overall: Record<string, number> = {};
    const byCategory: Record<ServiceCategory, Record<string, number>> =
      {} as Record<ServiceCategory, Record<string, number>>;

    for (const category of CATEGORIES) {
      byCategory[category] = {};
    }

    for (const { label, days: rawDays } of WINDOWS) {
      const windowStart =
        rawDays === -1
          ? new Date(endDate.getFullYear(), 0, 1) // Jan 1 of current year
          : new Date(endDate.getTime() - rawDays * 24 * 60 * 60 * 1000);
      const totalMinutes =
        (endDate.getTime() - windowStart.getTime()) / 60000;

      const windowIncidents = providerIncidents.filter(
        (inc) =>
          new Date(inc.startedAt) >= windowStart &&
          new Date(inc.startedAt) <= endDate
      );

      const overallDowntime = mergedDowntimeMinutes(windowIncidents);
      overall[label] =
        ((totalMinutes - overallDowntime) / totalMinutes) * 100;

      for (const category of CATEGORIES) {
        const catIncidents = windowIncidents.filter((inc) =>
          inc.affectedServices.some((svc) => svc.category === category)
        );
        const catDowntime = mergedDowntimeMinutes(catIncidents);
        byCategory[category][label] =
          ((totalMinutes - catDowntime) / totalMinutes) * 100;
      }
    }

    providers[provider] = { overall, byCategory };
  }

  return {
    generatedAt: endDate.toISOString(),
    providers,
  };
}
