export type Provider = "aws" | "azure" | "gcp";

export type Severity = "minor" | "major" | "critical";

export type IncidentStatus = "resolved" | "ongoing";

export type ServiceCategory =
  | "compute"
  | "storage"
  | "networking"
  | "database"
  | "ai-ml"
  | "security"
  | "analytics"
  | "devtools"
  | "messaging"
  | "management"
  | "other";

export interface StatusUpdate {
  timestamp: string;
  status: string;
  message: string;
}

export interface ServiceImpact {
  serviceName: string;
  category: ServiceCategory;
  regions: string[];
}

export interface Incident {
  id: string;
  provider: Provider;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  affectedServices: ServiceImpact[];
  updates: StatusUpdate[];
  sourceUrl: string;
}

export interface GcpRawIncident {
  id: string;
  number: string;
  begin: string;
  end: string;
  created: string;
  modified: string;
  external_desc: string;
  severity: string;
  status_impact: string;
  uri: string;
  affected_products: { title: string; id: string }[];
  most_recent_update: { text: string; status: string; when: string };
  updates: {
    text: string;
    status: string;
    when: string;
    created: string;
    modified: string;
  }[];
}

export interface AwsEventLogEntry {
  summary: string;
  message: string | null;
  status: number;
  timestamp: number; // seconds
}

export interface AwsRawEvent {
  service: string;
  region: string;
  typeCode: string;
  startTime: number; // milliseconds
  endTime?: number; // milliseconds, absent for ongoing
  lastUpdatedTime: number; // milliseconds
  metadata: {
    EVENT_LOG: string; // JSON-encoded AwsEventLogEntry[]
  };
}

export interface AwsHistoryEvent {
  summary: string;
  arn: string;
  status: string; // "0"=resolved, "1"=info, "2"=major, "3"=critical
  date: string; // unix timestamp in seconds (as string)
  event_log: AwsEventLogEntry[];
  impacted_services?: Record<
    string,
    { service_name: string; current: string; max: string }
  >;
}

export type AwsHistoryData = Record<string, AwsHistoryEvent[]>;

export type ServiceMap = Record<Provider, Record<string, ServiceCategory>>;

export interface UptimeScores {
  generatedAt: string;
  providers: Record<
    Provider,
    {
      overall: Record<string, number>;
      byCategory: Record<ServiceCategory, Record<string, number>>;
    }
  >;
}
