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
  { label: "365d", days: 365 },
];

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

    for (const { label, days } of WINDOWS) {
      const windowStart = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );
      const totalMinutes = days * 24 * 60;

      const windowIncidents = providerIncidents.filter(
        (inc) =>
          new Date(inc.startedAt) >= windowStart &&
          new Date(inc.startedAt) <= endDate
      );

      const overallDowntime = windowIncidents.reduce(
        (sum, inc) => sum + (inc.durationMinutes ?? 0),
        0
      );
      overall[label] =
        ((totalMinutes - overallDowntime) / totalMinutes) * 100;

      for (const category of CATEGORIES) {
        const catIncidents = windowIncidents.filter((inc) =>
          inc.affectedServices.some((svc) => svc.category === category)
        );
        const catDowntime = catIncidents.reduce(
          (sum, inc) => sum + (inc.durationMinutes ?? 0),
          0
        );
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
