import type {
  AwsRawEvent,
  AwsEventLogEntry,
  AwsHistoryData,
  AwsHistoryEvent,
  Incident,
} from "./types";
import { lookupCategory } from "./service-map";
import {
  mapAwsSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const AWS_EVENTS_URL = "https://health.aws.amazon.com/public/events";
const AWS_HISTORY_URL =
  "https://history-events-eu-west-1-prod.s3.amazonaws.com/historyevents.json";

export async function fetchAwsIncidents(): Promise<Incident[]> {
  const [liveIncidents, historyIncidents] = await Promise.all([
    fetchLiveEvents(),
    fetchHistoryEvents(),
  ]);

  // Merge: live events take precedence (more current data)
  const byId = new Map<string, Incident>();
  for (const inc of historyIncidents) byId.set(inc.id, inc);
  for (const inc of liveIncidents) byId.set(inc.id, inc);
  return Array.from(byId.values());
}

/** Fetch current/recent events from the live API (UTF-16 encoded) */
async function fetchLiveEvents(): Promise<Incident[]> {
  const response = await fetch(AWS_EVENTS_URL);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text: string;
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(bytes.subarray(2));
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(bytes.subarray(2));
  } else {
    text = new TextDecoder("utf-8").decode(bytes);
  }
  const raw: AwsRawEvent[] = JSON.parse(text);
  return raw.map(normalizeLiveEvent);
}

/** Fetch historical events from the S3 history bucket */
async function fetchHistoryEvents(): Promise<Incident[]> {
  const response = await fetch(AWS_HISTORY_URL);
  const data: AwsHistoryData = await response.json();
  return normalizeHistoryData(data);
}

/** Parse service and region from a history key like "ec2-us-east-1" or "cloudfront" */
function parseHistoryKey(key: string): { service: string; region: string } {
  // Some keys have no region (e.g., "cloudfront", "iam")
  const dashIdx = key.indexOf("-");
  // Check if what follows the dash looks like a region (contains another dash)
  if (dashIdx > 0) {
    const rest = key.slice(dashIdx + 1);
    if (rest.includes("-")) {
      return { service: key.slice(0, dashIdx), region: rest };
    }
  }
  return { service: key, region: "global" };
}

export function normalizeHistoryData(data: AwsHistoryData): Incident[] {
  // Deduplicate by ARN since same event may appear under multiple service keys
  const byArn = new Map<string, { event: AwsHistoryEvent; key: string }>();
  for (const [key, events] of Object.entries(data)) {
    for (const event of events) {
      if (!byArn.has(event.arn)) {
        byArn.set(event.arn, { event, key });
      }
    }
  }

  return Array.from(byArn.values()).map(({ event, key }) =>
    normalizeHistoryEvent(event, key)
  );
}

function normalizeHistoryEvent(
  raw: AwsHistoryEvent,
  serviceKey: string
): Incident {
  const { region } = parseHistoryKey(serviceKey);
  const startedAt = new Date(parseInt(raw.date) * 1000).toISOString();

  const eventLog = raw.event_log ?? [];
  const maxSeverity = Math.max(
    parseInt(raw.status) || 0,
    eventLog.reduce((max, entry) => Math.max(max, entry.status), 0)
  );
  const title = raw.summary.replace(/^\[RESOLVED\]\s*/i, "");

  // Extract end time from last event_log entry with status 0 (resolved)
  const lastEntry = eventLog[eventLog.length - 1];
  const isResolved =
    raw.summary.includes("[RESOLVED]") || lastEntry?.status === 0;
  const resolvedAt = isResolved && lastEntry
    ? new Date(lastEntry.timestamp * 1000).toISOString()
    : null;

  // Build affected services from impacted_services map
  const affectedServices = raw.impacted_services
    ? Object.values(raw.impacted_services).map((svc) => ({
        serviceName: svc.service_name,
        category: lookupCategory("aws", svc.service_name),
        regions: [region],
      }))
    : [
        {
          serviceName: awsServiceDisplayName(serviceKey.split("-")[0]),
          category: lookupCategory(
            "aws",
            awsServiceDisplayName(serviceKey.split("-")[0])
          ),
          regions: [region],
        },
      ];

  // Use ARN to generate a stable ID
  const arnId = raw.arn.split("/").pop() ?? raw.arn;

  return {
    id: makeIncidentId("aws", arnId),
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

/** AWS service codes to human-readable names */
const AWS_SERVICE_NAMES: Record<string, string> = {
  EC2: "Amazon EC2",
  S3: "Amazon S3",
  LAMBDA: "AWS Lambda",
  RDS: "Amazon RDS",
  DYNAMODB: "Amazon DynamoDB",
  CLOUDFRONT: "Amazon CloudFront",
  ECS: "Amazon ECS",
  EKS: "Amazon EKS",
  DIRECTCONNECT: "AWS Direct Connect",
  INTERNETCONNECTIVITY: "Internet Connectivity",
  MULTIPLE_SERVICES: "Multiple Services",
  ec2: "Amazon EC2",
  s3: "Amazon S3",
  lambda: "AWS Lambda",
  rds: "Amazon RDS",
  dynamodb: "Amazon DynamoDB",
  cloudfront: "Amazon CloudFront",
  directconnect: "AWS Direct Connect",
  internetconnectivity: "Internet Connectivity",
  multipleservices: "Multiple Services",
  iam: "AWS IAM",
  sqs: "Amazon SQS",
  glue: "AWS Glue",
  bedrock: "Amazon Bedrock",
  athena: "Amazon Athena",
  emr: "Amazon EMR",
  cognito: "Amazon Cognito",
  kinesis: "Amazon Kinesis",
  route53: "Amazon Route 53",
  management: "AWS Management Console",
  iamidentitycenter: "AWS IAM Identity Center",
  apprunner: "AWS App Runner",
  connect: "Amazon Connect",
  billingconsole: "AWS Billing Console",
  quicksight: "Amazon QuickSight",
  servicecatalog: "AWS Service Catalog",
  supportcenter: "AWS Support Center",
};

function awsServiceDisplayName(code: string): string {
  return AWS_SERVICE_NAMES[code] ?? `AWS ${code}`;
}

function normalizeLiveEvent(raw: AwsRawEvent): Incident {
  const startedAt = new Date(raw.startTime).toISOString();
  const resolvedAt = raw.endTime
    ? new Date(raw.endTime).toISOString()
    : null;

  const eventLog: AwsEventLogEntry[] = raw.metadata.EVENT_LOG
    ? JSON.parse(raw.metadata.EVENT_LOG)
    : [];
  const maxSeverity = eventLog.reduce(
    (max, entry) => Math.max(max, entry.status),
    0
  );
  const serviceName = awsServiceDisplayName(raw.service);
  const title = eventLog[0]?.summary ?? `${serviceName} issue`;

  const affectedServices = [
    {
      serviceName,
      category: lookupCategory("aws", serviceName),
      regions: [raw.region],
    },
  ];

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
