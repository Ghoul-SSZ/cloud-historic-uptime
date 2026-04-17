import type { AwsRawEvent, Incident } from "./types";
import { lookupCategory } from "./service-map";
import {
  mapAwsSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const AWS_EVENTS_URL = "https://health.aws.amazon.com/public/events";

export async function fetchAwsIncidents(): Promise<Incident[]> {
  const response = await fetch(AWS_EVENTS_URL);
  const raw: AwsRawEvent[] = await response.json();
  return raw.map(normalizeAwsEvent);
}

function normalizeAwsEvent(raw: AwsRawEvent): Incident {
  const startedAt = new Date(raw.startTime * 1000).toISOString();
  const resolvedAt = raw.endTime
    ? new Date(raw.endTime * 1000).toISOString()
    : null;

  const eventLog = raw.metadata.EVENT_LOG ?? [];
  const maxSeverity = eventLog.reduce(
    (max, entry) => Math.max(max, entry.status),
    0
  );
  const title = eventLog[0]?.summary ?? `${raw.service_name} issue`;

  const impactedList = Object.values(raw.impacted_services ?? {});
  const affectedServices = impactedList.map((svc) => ({
    serviceName: svc.service_name,
    category: lookupCategory("aws", svc.service_name),
    regions: [raw.region],
  }));

  return {
    id: makeIncidentId("aws", `${raw.typeCode}-${raw.startTime}`),
    provider: "aws",
    title,
    description: eventLog.at(-1)?.message ?? title,
    severity: mapAwsSeverity(maxSeverity),
    status: resolvedAt ? "resolved" : "ongoing",
    startedAt,
    resolvedAt,
    durationMinutes: computeDurationMinutes(startedAt, resolvedAt),
    affectedServices,
    updates: eventLog.map((entry) => ({
      timestamp: new Date(entry.timestamp * 1000).toISOString(),
      status: String(entry.status),
      message: entry.message ?? entry.summary,
    })),
    sourceUrl: "https://health.aws.amazon.com/health/status",
  };
}
