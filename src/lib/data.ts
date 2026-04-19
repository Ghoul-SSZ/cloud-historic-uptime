import awsRaw from "../../data/incidents/aws.json";
import azureRaw from "../../data/incidents/azure.json";
import gcpRaw from "../../data/incidents/gcp.json";
import uptimeRaw from "../../data/computed/uptime-scores.json";

export interface Incident {
  id: string;
  provider: "aws" | "azure" | "gcp";
  title: string;
  description: string;
  severity: "minor" | "major" | "critical";
  status: "resolved" | "ongoing";
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  affectedServices: {
    serviceName: string;
    category: string;
    regions: string[];
  }[];
  updates: { timestamp: string; status: string; message: string }[];
  sourceUrl: string;
}

type Provider = "aws" | "azure" | "gcp";

const incidentsByProvider: Record<Provider, Incident[]> = {
  aws: awsRaw as Incident[],
  azure: azureRaw as Incident[],
  gcp: gcpRaw as Incident[],
};

export const uptimeScores = uptimeRaw;

export function getAllIncidents(): Incident[] {
  return [...incidentsByProvider.aws, ...incidentsByProvider.azure, ...incidentsByProvider.gcp].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function getProviderIncidents(provider: Provider): Incident[] {
  return incidentsByProvider[provider] ?? [];
}

export function getIncidentById(id: string): Incident | undefined {
  return getAllIncidents().find((inc) => inc.id === id);
}

export function getRecentIncidents(limit: number): Incident[] {
  return getAllIncidents().slice(0, limit);
}

export const PROVIDER_META: Record<
  Provider,
  { name: string; color: string; statusUrl: string }
> = {
  aws: {
    name: "AWS",
    color: "#ff9900",
    statusUrl: "https://health.aws.amazon.com/health/status",
  },
  azure: {
    name: "Azure",
    color: "#00a4ef",
    statusUrl: "https://azure.status.microsoft/en-us/status/history/",
  },
  gcp: {
    name: "Google Cloud",
    color: "#0f9d58",
    statusUrl: "https://status.cloud.google.com/summary",
  },
};

export const PERIODS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
  { value: "ytd", label: "Year to date" },
  { value: "365d", label: "1 year" },
  { value: "2y", label: "2 years" },
  { value: "3y", label: "3 years" },
  { value: "5y", label: "5 years" },
];

export const PERIOD_TO_MONTHS: Record<string, number> = {
  "30d": 3,
  "90d": 6,
  "180d": 9,
  "ytd": Math.ceil(
    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
      (30.44 * 24 * 60 * 60 * 1000)
  ) || 1,
  "365d": 12,
  "2y": 24,
  "3y": 36,
  "5y": 60,
};

export const CATEGORY_LABELS: Record<string, string> = {
  compute: "Compute",
  storage: "Storage",
  networking: "Networking",
  database: "Database",
  "ai-ml": "AI/ML",
  security: "Security",
  analytics: "Analytics",
  devtools: "Dev Tools",
  messaging: "Messaging",
  management: "Management",
  other: "Other",
};

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "Ongoing";
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
