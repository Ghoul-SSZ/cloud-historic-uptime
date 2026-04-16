# Cloud Historic Uptime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public static site that scrapes AWS, Azure, and GCP status pages, normalizes incident data, computes uptime scores, and presents interactive charts comparing cloud provider reliability.

**Architecture:** TypeScript scrapers fetch data from 3 provider status pages, normalize into a common Incident schema, and write JSON to `data/`. An Astro site reads that JSON at build time, rendering static pages with React chart islands for interactivity. GitHub Actions runs scrapers daily and deploys to GitHub Pages on change.

**Tech Stack:** Astro, React, Recharts, TypeScript, Cheerio, Vitest, GitHub Actions, GitHub Pages

---

## File Map

### Scrapers (`scrapers/`)

| File | Responsibility |
|------|---------------|
| `scrapers/types.ts` | Shared types: `Incident`, `ServiceImpact`, `StatusUpdate`, `ServiceCategory`, raw provider response types |
| `scrapers/service-map.ts` | Loads `data/service-map.json`, exports `lookupCategory(provider, serviceName)` |
| `scrapers/normalize.ts` | Severity mapping, duration calculation, ID generation helpers |
| `scrapers/gcp.ts` | Fetches GCP incidents JSON, normalizes to `Incident[]` |
| `scrapers/aws.ts` | Fetches AWS events JSON, normalizes to `Incident[]` |
| `scrapers/azure.ts` | Scrapes Azure PIR HTML, normalizes to `Incident[]` |
| `scrapers/compute-uptime.ts` | Calculates uptime percentages from incident data per provider and category |
| `scrapers/run.ts` | CLI entrypoint: runs all scrapers, merges/deduplicates, computes uptime, writes JSON |

### Data (`data/`)

| File | Responsibility |
|------|---------------|
| `data/service-map.json` | Maps provider service names to normalized categories |
| `data/incidents/aws.json` | Normalized AWS incidents |
| `data/incidents/azure.json` | Normalized Azure incidents |
| `data/incidents/gcp.json` | Normalized GCP incidents |
| `data/computed/uptime-scores.json` | Pre-computed uptime percentages per provider/category/period |

### Astro Site (`src/`)

| File | Responsibility |
|------|---------------|
| `src/layouts/Base.astro` | Shared layout: nav bar, footer disclaimer, global styles |
| `src/lib/data.ts` | Data loading helpers for Astro pages — reads JSON, merges, sorts, filters |
| `src/pages/index.astro` | Dashboard: score cards, heatmap, recent incidents |
| `src/pages/provider/[name].astro` | Provider detail: uptime trend, category table, incident list |
| `src/pages/compare.astro` | Cross-provider: category bar chart, head-to-head matchups |
| `src/pages/incident/[id].astro` | Incident detail: timeline, affected services, source link |
| `src/pages/about.astro` | Methodology, data sources, disclaimer |
| `src/components/Heatmap.tsx` | React island: weekly incident heatmap for all 3 providers |
| `src/components/UptimeTrend.tsx` | React island: monthly uptime line chart (Recharts) |
| `src/components/CategoryBar.tsx` | React island: grouped bar chart comparing categories across providers |
| `src/components/IncidentList.tsx` | React island: filterable incident table with category/severity/date filters |

### CI/CD

| File | Responsibility |
|------|---------------|
| `.github/workflows/collect.yml` | Daily cron: run scrapers, commit data |
| `.github/workflows/deploy.yml` | On data/src change: build Astro, deploy to GH Pages |

### Root

| File | Responsibility |
|------|---------------|
| `README.md` | Project overview, live link, methodology, setup |
| `astro.config.mjs` | Astro config: React integration, GitHub Pages base path |
| `vitest.config.ts` | Vitest config for scraper tests |
| `tsconfig.json` | TypeScript config for scrapers + Astro |

---

## Phase 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize Astro project**

```bash
npm create astro@latest . -- --template minimal --install --no-git --typescript strict
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @astrojs/react react react-dom recharts
npm install -D vitest cheerio @types/react @types/react-dom tsx
```

- [ ] **Step 3: Configure Astro**

Replace `astro.config.mjs` with:

```javascript
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  site: "https://YOUR_USERNAME.github.io",
  base: "/cloud-historic-uptime",
  output: "static",
});
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scrapers/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:

```
node_modules/
dist/
.astro/
```

- [ ] **Step 6: Create data directory scaffolding**

```bash
mkdir -p data/incidents data/computed scrapers
```

Create `data/incidents/aws.json`:
```json
[]
```

Create `data/incidents/azure.json`:
```json
[]
```

Create `data/incidents/gcp.json`:
```json
[]
```

Create `data/computed/uptime-scores.json`:
```json
{
  "generatedAt": "",
  "providers": {}
}
```

- [ ] **Step 7: Verify Astro builds**

```bash
npm run build
```

Expected: Build succeeds, produces `dist/` directory.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro project with dependencies and data directories"
```

---

### Task 2: Shared Types & Service Map

**Files:**
- Create: `scrapers/types.ts`
- Create: `data/service-map.json`
- Create: `scrapers/service-map.ts`
- Create: `scrapers/service-map.test.ts`

- [ ] **Step 1: Write the types file**

Create `scrapers/types.ts`:

```typescript
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

// Raw provider response types

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

export interface AwsRawEvent {
  service: string;
  service_name: string;
  region: string;
  region_name: string;
  typeCode: string;
  startTime: number;
  endTime: number | null;
  lastUpdatedTime: number;
  statusCode: string;
  metadata: {
    EVENT_LOG: {
      summary: string;
      message: string | null;
      status: number;
      timestamp: number;
    }[];
  };
  impacted_services: Record<
    string,
    { service_name: string; current: number; max: number }
  >;
}

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
```

- [ ] **Step 2: Create the service map JSON**

Create `data/service-map.json`:

```json
{
  "aws": {
    "Amazon EC2": "compute",
    "AWS Lambda": "compute",
    "Amazon ECS": "compute",
    "Amazon EKS": "compute",
    "AWS Fargate": "compute",
    "Amazon Lightsail": "compute",
    "AWS Batch": "compute",
    "Amazon S3": "storage",
    "Amazon EBS": "storage",
    "Amazon EFS": "storage",
    "AWS Storage Gateway": "storage",
    "Amazon VPC": "networking",
    "Amazon CloudFront": "networking",
    "Amazon Route 53": "networking",
    "Elastic Load Balancing": "networking",
    "AWS Direct Connect": "networking",
    "Amazon API Gateway": "networking",
    "Amazon RDS": "database",
    "Amazon DynamoDB": "database",
    "Amazon ElastiCache": "database",
    "Amazon Redshift": "database",
    "Amazon Aurora": "database",
    "Amazon SageMaker": "ai-ml",
    "Amazon Bedrock": "ai-ml",
    "Amazon Rekognition": "ai-ml",
    "AWS IAM": "security",
    "AWS KMS": "security",
    "Amazon Cognito": "security",
    "Amazon Athena": "analytics",
    "Amazon Kinesis": "analytics",
    "Amazon EMR": "analytics",
    "AWS CodeBuild": "devtools",
    "AWS CodePipeline": "devtools",
    "AWS CodeDeploy": "devtools",
    "Amazon SNS": "messaging",
    "Amazon SQS": "messaging",
    "Amazon EventBridge": "messaging",
    "AWS CloudFormation": "management",
    "Amazon CloudWatch": "management",
    "AWS Systems Manager": "management"
  },
  "azure": {
    "Virtual Machines": "compute",
    "Azure Kubernetes Service (AKS)": "compute",
    "App Service": "compute",
    "Azure Functions": "compute",
    "Container Instances": "compute",
    "Blob Storage": "storage",
    "Azure Files": "storage",
    "Disk Storage": "storage",
    "Azure CDN": "networking",
    "Virtual Network": "networking",
    "Load Balancer": "networking",
    "Azure DNS": "networking",
    "Application Gateway": "networking",
    "Azure Front Door": "networking",
    "Azure SQL Database": "database",
    "Cosmos DB": "database",
    "Azure Cache for Redis": "database",
    "Azure Database for PostgreSQL": "database",
    "Azure Database for MySQL": "database",
    "Azure OpenAI Service": "ai-ml",
    "Azure Machine Learning": "ai-ml",
    "Azure Cognitive Services": "ai-ml",
    "Azure Active Directory": "security",
    "Key Vault": "security",
    "Microsoft Defender for Cloud": "security",
    "Azure Synapse Analytics": "analytics",
    "Azure Stream Analytics": "analytics",
    "Azure Data Factory": "analytics",
    "Azure DevOps": "devtools",
    "Azure Pipelines": "devtools",
    "Service Bus": "messaging",
    "Event Hubs": "messaging",
    "Event Grid": "messaging",
    "Azure Resource Manager": "management",
    "Azure Monitor": "management",
    "Azure Policy": "management"
  },
  "gcp": {
    "Compute Engine": "compute",
    "Google Kubernetes Engine": "compute",
    "Cloud Run": "compute",
    "Cloud Functions": "compute",
    "App Engine": "compute",
    "Cloud Storage": "storage",
    "Persistent Disk": "storage",
    "Filestore": "storage",
    "Cloud CDN": "networking",
    "Cloud Load Balancing": "networking",
    "Cloud DNS": "networking",
    "Virtual Private Cloud (VPC)": "networking",
    "Cloud SQL": "database",
    "Cloud Spanner": "database",
    "Firestore": "database",
    "Bigtable": "database",
    "Memorystore": "database",
    "AlloyDB": "database",
    "Vertex AI": "ai-ml",
    "Cloud AI Platform": "ai-ml",
    "Cloud Natural Language": "ai-ml",
    "Cloud IAM": "security",
    "Cloud KMS": "security",
    "Secret Manager": "security",
    "BigQuery": "analytics",
    "Dataflow": "analytics",
    "Dataproc": "analytics",
    "Pub/Sub": "analytics",
    "Cloud Build": "devtools",
    "Cloud Source Repositories": "devtools",
    "Artifact Registry": "devtools",
    "Cloud Tasks": "messaging",
    "Cloud Scheduler": "messaging",
    "Eventarc": "messaging",
    "Cloud Deployment Manager": "management",
    "Cloud Monitoring": "management",
    "Cloud Logging": "management"
  }
}
```

- [ ] **Step 3: Write the failing test for service-map loader**

Create `scrapers/service-map.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { lookupCategory, loadServiceMap } from "./service-map";

describe("loadServiceMap", () => {
  it("loads the service map from JSON", () => {
    const map = loadServiceMap();
    expect(map.aws).toBeDefined();
    expect(map.azure).toBeDefined();
    expect(map.gcp).toBeDefined();
  });
});

describe("lookupCategory", () => {
  it("returns the correct category for a known service", () => {
    expect(lookupCategory("aws", "Amazon EC2")).toBe("compute");
    expect(lookupCategory("azure", "Cosmos DB")).toBe("database");
    expect(lookupCategory("gcp", "Cloud Storage")).toBe("storage");
  });

  it('returns "other" for unknown services', () => {
    expect(lookupCategory("aws", "SomeNewService")).toBe("other");
  });

  it("handles case-insensitive partial matching", () => {
    expect(lookupCategory("aws", "Amazon EC2 - Auto Scaling")).toBe("other");
    expect(lookupCategory("aws", "Amazon EC2")).toBe("compute");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run scrapers/service-map.test.ts
```

Expected: FAIL — `Cannot find module './service-map'`

- [ ] **Step 5: Implement service-map loader**

Create `scrapers/service-map.ts`:

```typescript
import { readFileSync } from "fs";
import { join } from "path";
import type { Provider, ServiceCategory, ServiceMap } from "./types";

let cachedMap: ServiceMap | null = null;

export function loadServiceMap(): ServiceMap {
  if (cachedMap) return cachedMap;
  const raw = readFileSync(
    join(import.meta.dirname, "../data/service-map.json"),
    "utf-8"
  );
  cachedMap = JSON.parse(raw) as ServiceMap;
  return cachedMap;
}

export function lookupCategory(
  provider: Provider,
  serviceName: string
): ServiceCategory {
  const map = loadServiceMap();
  const providerMap = map[provider];
  return providerMap[serviceName] ?? "other";
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run scrapers/service-map.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scrapers/types.ts scrapers/service-map.ts scrapers/service-map.test.ts data/service-map.json data/incidents/ data/computed/
git commit -m "feat: add shared types, service category map, and data scaffolding"
```

---

### Task 3: Normalize Helpers

**Files:**
- Create: `scrapers/normalize.ts`
- Create: `scrapers/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scrapers/normalize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  mapGcpSeverity,
  mapAwsSeverity,
  inferAzureSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

describe("mapGcpSeverity", () => {
  it("maps high to critical", () => {
    expect(mapGcpSeverity("high")).toBe("critical");
  });
  it("maps medium to major", () => {
    expect(mapGcpSeverity("medium")).toBe("major");
  });
  it("maps low to minor", () => {
    expect(mapGcpSeverity("low")).toBe("minor");
  });
  it("defaults unknown to minor", () => {
    expect(mapGcpSeverity("unknown")).toBe("minor");
  });
});

describe("mapAwsSeverity", () => {
  it("maps status 3 to critical", () => {
    expect(mapAwsSeverity(3)).toBe("critical");
  });
  it("maps status 2 to major", () => {
    expect(mapAwsSeverity(2)).toBe("major");
  });
  it("maps status 1 to minor", () => {
    expect(mapAwsSeverity(1)).toBe("minor");
  });
  it("defaults 0 to minor", () => {
    expect(mapAwsSeverity(0)).toBe("minor");
  });
});

describe("inferAzureSeverity", () => {
  it("returns critical for outage keywords", () => {
    expect(inferAzureSeverity("widespread outage affecting all regions", 5)).toBe("critical");
  });
  it("returns major for degradation with multiple services", () => {
    expect(inferAzureSeverity("service degradation detected", 3)).toBe("major");
  });
  it("returns minor for low-impact", () => {
    expect(inferAzureSeverity("intermittent connectivity issues", 1)).toBe("minor");
  });
});

describe("computeDurationMinutes", () => {
  it("computes duration between two ISO timestamps", () => {
    const start = "2026-01-15T10:00:00Z";
    const end = "2026-01-15T11:30:00Z";
    expect(computeDurationMinutes(start, end)).toBe(90);
  });
  it("returns null if end is null", () => {
    expect(computeDurationMinutes("2026-01-15T10:00:00Z", null)).toBeNull();
  });
});

describe("makeIncidentId", () => {
  it("prefixes with provider", () => {
    expect(makeIncidentId("aws", "abc123")).toBe("aws-abc123");
    expect(makeIncidentId("gcp", "xyz")).toBe("gcp-xyz");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run scrapers/normalize.test.ts
```

Expected: FAIL — `Cannot find module './normalize'`

- [ ] **Step 3: Implement normalize helpers**

Create `scrapers/normalize.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scrapers/normalize.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrapers/normalize.ts scrapers/normalize.test.ts
git commit -m "feat: add severity mapping and normalization helpers"
```

---

## Phase 2: Scrapers

### Task 4: GCP Scraper

**Files:**
- Create: `scrapers/gcp.ts`
- Create: `scrapers/gcp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scrapers/gcp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGcpIncidents } from "./gcp";
import type { GcpRawIncident } from "./types";

const mockGcpResponse: GcpRawIncident[] = [
  {
    id: "abc123",
    number: "1234567890",
    begin: "2026-01-15T10:00:00+00:00",
    end: "2026-01-15T11:30:00+00:00",
    created: "2026-01-15T10:15:00+00:00",
    modified: "2026-01-16T08:00:00+00:00",
    external_desc: "Cloud SQL connectivity issues in us-central1",
    severity: "medium",
    status_impact: "SERVICE_DISRUPTION",
    uri: "https://status.cloud.google.com/incidents/abc123",
    affected_products: [
      { title: "Cloud SQL", id: "sql-1" },
      { title: "Cloud Run", id: "run-1" },
    ],
    most_recent_update: {
      text: "Issue resolved.",
      status: "AVAILABLE",
      when: "2026-01-15T11:30:00+00:00",
    },
    updates: [
      {
        text: "Investigating connectivity issues with Cloud SQL.",
        status: "SERVICE_DISRUPTION",
        when: "2026-01-15T10:15:00+00:00",
        created: "2026-01-15T10:15:00+00:00",
        modified: "2026-01-15T10:15:00+00:00",
      },
      {
        text: "Issue resolved. Cloud SQL is operating normally.",
        status: "AVAILABLE",
        when: "2026-01-15T11:30:00+00:00",
        created: "2026-01-15T11:30:00+00:00",
        modified: "2026-01-15T11:30:00+00:00",
      },
    ],
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchGcpIncidents", () => {
  it("fetches and normalizes GCP incidents", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockGcpResponse))
    );

    const incidents = await fetchGcpIncidents();

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.id).toBe("gcp-abc123");
    expect(inc.provider).toBe("gcp");
    expect(inc.title).toBe("Cloud SQL connectivity issues in us-central1");
    expect(inc.severity).toBe("major");
    expect(inc.status).toBe("resolved");
    expect(inc.startedAt).toBe("2026-01-15T10:00:00+00:00");
    expect(inc.resolvedAt).toBe("2026-01-15T11:30:00+00:00");
    expect(inc.durationMinutes).toBe(90);
    expect(inc.affectedServices).toHaveLength(2);
    expect(inc.affectedServices[0]).toEqual({
      serviceName: "Cloud SQL",
      category: "database",
      regions: [],
    });
    expect(inc.affectedServices[1]).toEqual({
      serviceName: "Cloud Run",
      category: "compute",
      regions: [],
    });
    expect(inc.updates).toHaveLength(2);
    expect(inc.sourceUrl).toBe(
      "https://status.cloud.google.com/incidents/abc123"
    );
  });

  it("handles ongoing incidents (no end time)", async () => {
    const ongoing = [{ ...mockGcpResponse[0], end: "", id: "ongoing1" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(ongoing))
    );

    const incidents = await fetchGcpIncidents();
    expect(incidents[0].status).toBe("ongoing");
    expect(incidents[0].resolvedAt).toBeNull();
    expect(incidents[0].durationMinutes).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run scrapers/gcp.test.ts
```

Expected: FAIL — `Cannot find module './gcp'`

- [ ] **Step 3: Implement GCP scraper**

Create `scrapers/gcp.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scrapers/gcp.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrapers/gcp.ts scrapers/gcp.test.ts
git commit -m "feat: add GCP scraper with incident normalization"
```

---

### Task 5: AWS Scraper

**Files:**
- Create: `scrapers/aws.ts`
- Create: `scrapers/aws.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scrapers/aws.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwsIncidents } from "./aws";
import type { AwsRawEvent } from "./types";

const mockAwsResponse: AwsRawEvent[] = [
  {
    service: "S3",
    service_name: "Amazon S3",
    region: "us-east-1",
    region_name: "US East (N. Virginia)",
    typeCode: "AWS_S3_OPERATIONAL_ISSUE",
    startTime: 1736935200,
    endTime: 1736938020,
    lastUpdatedTime: 1736938020,
    statusCode: "closed",
    metadata: {
      EVENT_LOG: [
        {
          summary: "Elevated error rates on S3",
          message: "We are investigating elevated 5xx error rates for S3 in us-east-1.",
          status: 2,
          timestamp: 1736935200,
        },
        {
          summary: "Issue resolved",
          message: "S3 error rates have returned to normal levels.",
          status: 0,
          timestamp: 1736938020,
        },
      ],
    },
    impacted_services: {
      s3: { service_name: "Amazon S3", current: 0, max: 2 },
      lambda: { service_name: "AWS Lambda", current: 0, max: 1 },
    },
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAwsIncidents", () => {
  it("fetches and normalizes AWS incidents", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockAwsResponse))
    );

    const incidents = await fetchAwsIncidents();

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.id).toBe("aws-AWS_S3_OPERATIONAL_ISSUE-1736935200");
    expect(inc.provider).toBe("aws");
    expect(inc.title).toBe("Elevated error rates on S3");
    expect(inc.severity).toBe("major");
    expect(inc.status).toBe("resolved");
    expect(inc.startedAt).toBe("2025-01-15T10:00:00.000Z");
    expect(inc.resolvedAt).toBe("2025-01-15T10:47:00.000Z");
    expect(inc.durationMinutes).toBe(47);
    expect(inc.affectedServices).toHaveLength(2);
    expect(inc.affectedServices[0]).toEqual({
      serviceName: "Amazon S3",
      category: "storage",
      regions: ["us-east-1"],
    });
    expect(inc.affectedServices[1]).toEqual({
      serviceName: "AWS Lambda",
      category: "compute",
      regions: ["us-east-1"],
    });
    expect(inc.updates).toHaveLength(2);
  });

  it("handles ongoing incidents (no endTime)", async () => {
    const ongoing = [{ ...mockAwsResponse[0], endTime: null, statusCode: "open" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(ongoing))
    );

    const incidents = await fetchAwsIncidents();
    expect(incidents[0].status).toBe("ongoing");
    expect(incidents[0].resolvedAt).toBeNull();
    expect(incidents[0].durationMinutes).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run scrapers/aws.test.ts
```

Expected: FAIL — `Cannot find module './aws'`

- [ ] **Step 3: Implement AWS scraper**

Create `scrapers/aws.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scrapers/aws.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrapers/aws.ts scrapers/aws.test.ts
git commit -m "feat: add AWS scraper with incident normalization"
```

---

### Task 6: Azure Scraper

**Files:**
- Create: `scrapers/azure.ts`
- Create: `scrapers/azure.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scrapers/azure.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAzureIncidents, parseAzurePirHtml } from "./azure";

const mockHtml = `
<html><body>
<div class="event-list">
  <div class="event-row" data-tracking-id="PIR-123">
    <div class="event-title">Virtual Machines - West Europe</div>
    <div class="event-date">
      <span class="start-date">2026-01-10T08:00:00Z</span>
      <span class="end-date">2026-01-10T10:15:00Z</span>
    </div>
    <div class="event-summary">
      Customers using Virtual Machines in West Europe experienced degraded performance.
      Impact was also observed on Azure Kubernetes Service (AKS) and Load Balancer.
    </div>
    <div class="impacted-services">
      <span class="service-tag">Virtual Machines</span>
      <span class="service-tag">Azure Kubernetes Service (AKS)</span>
      <span class="service-tag">Load Balancer</span>
    </div>
  </div>
</div>
</body></html>
`;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("parseAzurePirHtml", () => {
  it("extracts incidents from Azure PIR HTML", () => {
    const incidents = parseAzurePirHtml(mockHtml);

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.id).toBe("azure-PIR-123");
    expect(inc.provider).toBe("azure");
    expect(inc.title).toBe("Virtual Machines - West Europe");
    expect(inc.severity).toBe("major");
    expect(inc.status).toBe("resolved");
    expect(inc.affectedServices).toHaveLength(3);
    expect(inc.affectedServices[0]).toEqual({
      serviceName: "Virtual Machines",
      category: "compute",
      regions: [],
    });
    expect(inc.durationMinutes).toBe(135);
  });

  it("returns empty array for HTML with no incidents", () => {
    const incidents = parseAzurePirHtml("<html><body></body></html>");
    expect(incidents).toEqual([]);
  });
});

describe("fetchAzureIncidents", () => {
  it("fetches and parses Azure status page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(mockHtml)
    );

    const incidents = await fetchAzureIncidents();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].provider).toBe("azure");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run scrapers/azure.test.ts
```

Expected: FAIL — `Cannot find module './azure'`

- [ ] **Step 3: Implement Azure scraper**

Create `scrapers/azure.ts`:

```typescript
import * as cheerio from "cheerio";
import type { Incident } from "./types";
import { lookupCategory } from "./service-map";
import {
  inferAzureSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const AZURE_STATUS_URL =
  "https://azure.status.microsoft/en-us/status/history/";

export async function fetchAzureIncidents(): Promise<Incident[]> {
  const response = await fetch(AZURE_STATUS_URL);
  const html = await response.text();
  return parseAzurePirHtml(html);
}

export function parseAzurePirHtml(html: string): Incident[] {
  const $ = cheerio.load(html);
  const incidents: Incident[] = [];

  $(".event-row").each((_i, el) => {
    const row = $(el);
    const trackingId = row.attr("data-tracking-id");
    if (!trackingId) return;

    const title = row.find(".event-title").text().trim();
    const summary = row.find(".event-summary").text().trim();
    const startDate = row.find(".start-date").text().trim();
    const endDate = row.find(".end-date").text().trim();

    const serviceNames: string[] = [];
    row.find(".service-tag").each((_j, tag) => {
      serviceNames.push($(tag).text().trim());
    });

    if (!title || !startDate) return;

    const resolvedAt = endDate || null;

    incidents.push({
      id: makeIncidentId("azure", trackingId),
      provider: "azure",
      title,
      description: summary || title,
      severity: inferAzureSeverity(summary || title, serviceNames.length),
      status: resolvedAt ? "resolved" : "ongoing",
      startedAt: startDate,
      resolvedAt,
      durationMinutes: computeDurationMinutes(startDate, resolvedAt),
      affectedServices: serviceNames.map((name) => ({
        serviceName: name,
        category: lookupCategory("azure", name),
        regions: [],
      })),
      updates: [],
      sourceUrl: `https://azure.status.microsoft/en-us/status/history/#${trackingId}`,
    });
  });

  return incidents;
}
```

**Note:** Azure's actual HTML structure will differ from this mock. The selectors (`.event-row`, `.event-title`, `.service-tag`, etc.) are best-guess based on typical status page patterns. The first real run will require inspecting the actual HTML and adjusting these selectors. The test uses a controlled HTML fixture so the parsing logic is verified — only the selectors need updating when the real page is examined.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scrapers/azure.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrapers/azure.ts scrapers/azure.test.ts
git commit -m "feat: add Azure scraper with HTML PIR parsing"
```

---

### Task 7: Uptime Computation

**Files:**
- Create: `scrapers/compute-uptime.ts`
- Create: `scrapers/compute-uptime.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scrapers/compute-uptime.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeUptimeScores } from "./compute-uptime";
import type { Incident } from "./types";

const testIncidents: Incident[] = [
  {
    id: "aws-1",
    provider: "aws",
    title: "S3 outage",
    description: "S3 was down",
    severity: "critical",
    status: "resolved",
    startedAt: "2026-01-15T10:00:00Z",
    resolvedAt: "2026-01-15T11:00:00Z",
    durationMinutes: 60,
    affectedServices: [
      { serviceName: "Amazon S3", category: "storage", regions: ["us-east-1"] },
    ],
    updates: [],
    sourceUrl: "https://example.com",
  },
  {
    id: "gcp-1",
    provider: "gcp",
    title: "Cloud SQL issue",
    description: "Cloud SQL had issues",
    severity: "major",
    status: "resolved",
    startedAt: "2026-01-20T14:00:00Z",
    resolvedAt: "2026-01-20T14:30:00Z",
    durationMinutes: 30,
    affectedServices: [
      { serviceName: "Cloud SQL", category: "database", regions: [] },
    ],
    updates: [],
    sourceUrl: "https://example.com",
  },
];

describe("computeUptimeScores", () => {
  it("computes overall uptime per provider for a 90-day window", () => {
    const endDate = new Date("2026-02-01T00:00:00Z");
    const scores = computeUptimeScores(testIncidents, endDate);

    expect(scores.providers.aws).toBeDefined();
    expect(scores.providers.gcp).toBeDefined();
    expect(scores.providers.azure).toBeDefined();

    // AWS had 60 min downtime in 90 days = 129600 minutes
    // 129540 / 129600 * 100 = ~99.9537%
    expect(scores.providers.aws.overall["90d"]).toBeCloseTo(99.9537, 2);

    // GCP had 30 min downtime
    expect(scores.providers.gcp.overall["90d"]).toBeCloseTo(99.9769, 2);

    // Azure had 0 downtime
    expect(scores.providers.azure.overall["90d"]).toBe(100);
  });

  it("computes per-category uptime", () => {
    const endDate = new Date("2026-02-01T00:00:00Z");
    const scores = computeUptimeScores(testIncidents, endDate);

    // AWS storage had 60 min downtime
    expect(scores.providers.aws.byCategory.storage["90d"]).toBeCloseTo(
      99.9537,
      2
    );
    // AWS compute had 0 downtime
    expect(scores.providers.aws.byCategory.compute["90d"]).toBe(100);
  });

  it("ignores incidents outside the time window", () => {
    const endDate = new Date("2025-12-01T00:00:00Z");
    const scores = computeUptimeScores(testIncidents, endDate);

    expect(scores.providers.aws.overall["90d"]).toBe(100);
    expect(scores.providers.gcp.overall["90d"]).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run scrapers/compute-uptime.test.ts
```

Expected: FAIL — `Cannot find module './compute-uptime'`

- [ ] **Step 3: Implement uptime computation**

Create `scrapers/compute-uptime.ts`:

```typescript
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

      // Overall downtime
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

      // Per-category downtime
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run scrapers/compute-uptime.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrapers/compute-uptime.ts scrapers/compute-uptime.test.ts
git commit -m "feat: add uptime score computation from incident data"
```

---

### Task 8: Scraper CLI Runner

**Files:**
- Create: `scrapers/run.ts`

- [ ] **Step 1: Implement the CLI runner**

Create `scrapers/run.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fetchGcpIncidents } from "./gcp";
import { fetchAwsIncidents } from "./aws";
import { fetchAzureIncidents } from "./azure";
import { computeUptimeScores } from "./compute-uptime";
import type { Incident, Provider } from "./types";

const DATA_DIR = join(import.meta.dirname, "../data");
const INCIDENTS_DIR = join(DATA_DIR, "incidents");
const COMPUTED_DIR = join(DATA_DIR, "computed");

function loadExisting(provider: Provider): Incident[] {
  try {
    const raw = readFileSync(
      join(INCIDENTS_DIR, `${provider}.json`),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mergeIncidents(
  existing: Incident[],
  fresh: Incident[]
): Incident[] {
  const byId = new Map<string, Incident>();
  for (const inc of existing) byId.set(inc.id, inc);
  for (const inc of fresh) byId.set(inc.id, inc);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

async function runScraper(
  name: string,
  fetcher: () => Promise<Incident[]>,
  provider: Provider
): Promise<Incident[]> {
  console.log(`[${name}] Fetching incidents...`);
  try {
    const fresh = await fetcher();
    console.log(`[${name}] Got ${fresh.length} incidents`);
    const existing = loadExisting(provider);
    const merged = mergeIncidents(existing, fresh);
    console.log(
      `[${name}] Merged: ${existing.length} existing + ${fresh.length} new = ${merged.length} total`
    );
    return merged;
  } catch (err) {
    console.error(`[${name}] Failed:`, err);
    return loadExisting(provider);
  }
}

async function main() {
  mkdirSync(INCIDENTS_DIR, { recursive: true });
  mkdirSync(COMPUTED_DIR, { recursive: true });

  const [awsIncidents, azureIncidents, gcpIncidents] =
    await Promise.all([
      runScraper("AWS", fetchAwsIncidents, "aws"),
      runScraper("Azure", fetchAzureIncidents, "azure"),
      runScraper("GCP", fetchGcpIncidents, "gcp"),
    ]);

  writeFileSync(
    join(INCIDENTS_DIR, "aws.json"),
    JSON.stringify(awsIncidents, null, 2)
  );
  writeFileSync(
    join(INCIDENTS_DIR, "azure.json"),
    JSON.stringify(azureIncidents, null, 2)
  );
  writeFileSync(
    join(INCIDENTS_DIR, "gcp.json"),
    JSON.stringify(gcpIncidents, null, 2)
  );

  const allIncidents = [...awsIncidents, ...azureIncidents, ...gcpIncidents];
  const scores = computeUptimeScores(allIncidents);
  writeFileSync(
    join(COMPUTED_DIR, "uptime-scores.json"),
    JSON.stringify(scores, null, 2)
  );

  console.log(`Done. ${allIncidents.length} total incidents across all providers.`);
}

main();
```

- [ ] **Step 2: Add npm script for running scrapers**

In `package.json`, add to the `"scripts"` section:

```json
"collect": "tsx scrapers/run.ts"
```

- [ ] **Step 3: Verify the runner executes**

```bash
npm run collect
```

Expected: Runner executes, fetches data from all 3 providers (some may fail due to HTML structure differences — that's expected), writes JSON to `data/`.

- [ ] **Step 4: Run all scraper tests**

```bash
npx vitest run
```

Expected: All scraper tests pass.

- [ ] **Step 5: Commit**

```bash
git add scrapers/run.ts package.json
git commit -m "feat: add scraper CLI runner with merge and deduplication"
```

---

## Phase 3: Frontend

### Task 9: Base Layout

**Files:**
- Create: `src/layouts/Base.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create the base layout**

Create `src/layouts/Base.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description = "Historical uptime comparison for AWS, Azure, and Google Cloud" } = Astro.props;
const base = import.meta.env.BASE_URL;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title} | Cloud Historic Uptime</title>
  </head>
  <body>
    <nav class="nav">
      <div class="nav-inner">
        <a href={base} class="nav-brand">Cloud Historic Uptime</a>
        <div class="nav-links">
          <a href={base}>Dashboard</a>
          <a href={`${base}provider/aws`}>AWS</a>
          <a href={`${base}provider/azure`}>Azure</a>
          <a href={`${base}provider/gcp`}>GCP</a>
          <a href={`${base}compare`}>Compare</a>
        </div>
      </div>
    </nav>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <p>
        Data sourced from official provider status pages. Not affiliated with
        AWS, Microsoft, or Google. Uptime scores are calculated estimates based
        on publicly reported incidents — actual SLA performance may differ.
        <a href={`${base}about`}>Learn more →</a>
      </p>
    </footer>

    <style is:global>
      :root {
        --bg: #0f1117;
        --bg-card: #1a1d2e;
        --border: #2a2d3e;
        --text: #e2e8f0;
        --text-muted: #8892a4;
        --aws: #ff9900;
        --azure: #0078d4;
        --gcp: #4285f4;
        --green: #10b981;
        --yellow: #f59e0b;
        --red: #ef4444;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }

      a { color: var(--gcp); text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>

    <style>
      .nav {
        border-bottom: 1px solid var(--border);
        padding: 1rem 0;
      }

      .nav-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .nav-brand {
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--text);
      }

      .nav-links {
        display: flex;
        gap: 1.5rem;
        font-size: 0.9rem;
      }

      .nav-links a { color: var(--text-muted); }
      .nav-links a:hover { color: var(--text); text-decoration: none; }

      .main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1.5rem;
      }

      .footer {
        border-top: 1px solid var(--border);
        padding: 1.5rem;
        text-align: center;
        font-size: 0.8rem;
        color: var(--text-muted);
        max-width: 800px;
        margin: 4rem auto 0;
      }
    </style>
  </body>
</html>
```

- [ ] **Step 2: Update index.astro to use layout**

Replace `src/pages/index.astro`:

```astro
---
import Base from "../layouts/Base.astro";
---

<Base title="Dashboard">
  <h1>Dashboard</h1>
  <p>Coming soon.</p>
</Base>
```

- [ ] **Step 3: Verify it renders**

```bash
npm run dev
```

Open `http://localhost:4321/cloud-historic-uptime/`. Verify: nav bar shows all links, footer shows disclaimer, dark theme renders correctly.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Base.astro src/pages/index.astro
git commit -m "feat: add base layout with nav and footer disclaimer"
```

---

### Task 10: Data Loading Helpers

**Files:**
- Create: `src/lib/data.ts`

- [ ] **Step 1: Create data helpers**

Create `src/lib/data.ts`:

```typescript
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
    color: "#0078d4",
    statusUrl: "https://azure.status.microsoft/en-us/status/history/",
  },
  gcp: {
    name: "Google Cloud",
    color: "#4285f4",
    statusUrl: "https://status.cloud.google.com/summary",
  },
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: add data loading helpers for Astro pages"
```

---

### Task 11: Dashboard Page + Heatmap

**Files:**
- Create: `src/components/Heatmap.tsx`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create the Heatmap component**

Create `src/components/Heatmap.tsx`:

```tsx
import type { ReactElement } from "react";

interface HeatmapProps {
  incidents: {
    provider: string;
    startedAt: string;
    severity: string;
  }[];
  weeks: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  clean: "#064e3b",
  minor: "#f59e0b",
  major: "#ea580c",
  critical: "#ef4444",
};

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  aws: { label: "AWS", color: "#ff9900" },
  azure: { label: "Azure", color: "#0078d4" },
  gcp: { label: "GCP", color: "#4285f4" },
};

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function buildWeekGrid(
  incidents: HeatmapProps["incidents"],
  weeks: number,
  provider: string
): { key: string; severity: string }[] {
  const now = new Date();
  const grid: { key: string; severity: string }[] = [];

  const providerIncidents = incidents.filter(
    (inc) => inc.provider === provider
  );
  const worstByWeek = new Map<string, string>();

  for (const inc of providerIncidents) {
    const key = getWeekKey(new Date(inc.startedAt));
    const current = worstByWeek.get(key);
    if (
      !current ||
      severityRank(inc.severity) > severityRank(current)
    ) {
      worstByWeek.set(key, inc.severity);
    }
  }

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = getWeekKey(d);
    grid.push({ key, severity: worstByWeek.get(key) ?? "clean" });
  }

  return grid;
}

function severityRank(s: string): number {
  switch (s) {
    case "critical": return 3;
    case "major": return 2;
    case "minor": return 1;
    default: return 0;
  }
}

export default function Heatmap({
  incidents,
  weeks = 52,
}: HeatmapProps): ReactElement {
  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Incident Heatmap — Last {weeks} Weeks
      </h3>
      {(["aws", "azure", "gcp"] as const).map((provider) => {
        const grid = buildWeekGrid(incidents, weeks, provider);
        const meta = PROVIDER_LABELS[provider];
        return (
          <div key={provider} style={{ marginBottom: "0.75rem" }}>
            <div style={{ color: meta.color, fontSize: "0.75rem", marginBottom: 4 }}>
              {meta.label}
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {grid.map((cell, i) => (
                <div
                  key={i}
                  title={`${cell.key}: ${cell.severity}`}
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 2,
                    background: SEVERITY_COLORS[cell.severity],
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.7rem", color: "#8892a4" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.clean, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          No incidents
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.minor, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Minor
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.major, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Major
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: SEVERITY_COLORS.critical, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />
          Critical
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the dashboard page**

Replace `src/pages/index.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import Heatmap from "../components/Heatmap";
import {
  getRecentIncidents,
  getAllIncidents,
  uptimeScores,
  PROVIDER_META,
  formatDuration,
  formatRelativeTime,
} from "../lib/data";

const recent = getRecentIncidents(10);
const allIncidents = getAllIncidents();
const base = import.meta.env.BASE_URL;

const providers = ["aws", "azure", "gcp"] as const;
---

<Base title="Dashboard">
  <h1 class="page-title">Cloud Provider Uptime Dashboard</h1>

  <div class="score-cards">
    {providers.map((p) => {
      const score = uptimeScores.providers[p]?.overall?.["90d"];
      const meta = PROVIDER_META[p];
      return (
        <a href={`${base}provider/${p}`} class="score-card">
          <div class="score-value" style={`color: ${meta.color}`}>
            {score !== undefined ? `${score.toFixed(2)}%` : "—"}
          </div>
          <div class="score-label">{meta.name} (90-day)</div>
        </a>
      );
    })}
  </div>

  <div class="section">
    <Heatmap
      client:load
      incidents={allIncidents.map((inc) => ({
        provider: inc.provider,
        startedAt: inc.startedAt,
        severity: inc.severity,
      }))}
      weeks={52}
    />
  </div>

  <div class="section">
    <h2 class="section-title">Recent Incidents</h2>
    <div class="incident-list">
      {recent.map((inc) => {
        const meta = PROVIDER_META[inc.provider];
        return (
          <a href={`${base}incident/${inc.id}`} class="incident-row">
            <div class="incident-left">
              <span class="provider-badge" style={`color: ${meta.color}; background: ${meta.color}22`}>
                {meta.name}
              </span>
              <span class="incident-title">{inc.title}</span>
            </div>
            <div class="incident-right">
              <span class="incident-time">{formatRelativeTime(inc.startedAt)}</span>
              <span class="incident-duration">· {formatDuration(inc.durationMinutes)}</span>
            </div>
          </a>
        );
      })}
      {recent.length === 0 && (
        <p class="empty-state">No incidents recorded yet. Run the scraper to collect data.</p>
      )}
    </div>
  </div>
</Base>

<style>
  .page-title {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .score-cards {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .score-card {
    flex: 1;
    min-width: 180px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    text-decoration: none;
    transition: border-color 0.2s;
  }

  .score-card:hover {
    border-color: #4a4d5e;
    text-decoration: none;
  }

  .score-value { font-size: 1.75rem; font-weight: 700; }
  .score-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }

  .section { margin-bottom: 2rem; }
  .section-title { font-size: 1.1rem; margin-bottom: 1rem; }

  .incident-list {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .incident-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--text);
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .incident-row:last-child { border-bottom: none; }
  .incident-row:hover { background: #1f2235; }

  .incident-left { display: flex; align-items: center; gap: 0.75rem; }

  .provider-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    white-space: nowrap;
  }

  .incident-title { font-size: 0.9rem; }

  .incident-right {
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    gap: 0.25rem;
    white-space: nowrap;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
</style>
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:4321/cloud-historic-uptime/`. Verify: score cards render (showing "—" if no data), heatmap renders with all-green cells, recent incidents section shows empty state or scraped data.

- [ ] **Step 4: Commit**

```bash
git add src/components/Heatmap.tsx src/pages/index.astro
git commit -m "feat: add dashboard page with score cards, heatmap, and incident feed"
```

---

### Task 12: Provider Detail Page + Uptime Trend Chart

**Files:**
- Create: `src/components/UptimeTrend.tsx`
- Create: `src/components/IncidentList.tsx`
- Create: `src/pages/provider/[name].astro`

- [ ] **Step 1: Create UptimeTrend component**

Create `src/components/UptimeTrend.tsx`:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface UptimeTrendProps {
  incidents: {
    startedAt: string;
    durationMinutes: number | null;
  }[];
  color: string;
  months: number;
}

function computeMonthlyUptime(
  incidents: UptimeTrendProps["incidents"],
  months: number
): { month: string; uptime: number }[] {
  const now = new Date();
  const data: { month: string; uptime: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const totalMinutes =
      (monthEnd.getTime() - d.getTime()) / 60000;

    const monthIncidents = incidents.filter((inc) => {
      const incDate = new Date(inc.startedAt);
      return (
        incDate.getFullYear() === d.getFullYear() &&
        incDate.getMonth() === d.getMonth() &&
        inc.durationMinutes !== null
      );
    });

    const downtime = monthIncidents.reduce(
      (sum, inc) => sum + (inc.durationMinutes ?? 0),
      0
    );

    data.push({
      month: d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      uptime: Number((((totalMinutes - downtime) / totalMinutes) * 100).toFixed(4)),
    });
  }

  return data;
}

export default function UptimeTrend({
  incidents,
  color,
  months = 12,
}: UptimeTrendProps) {
  const data = computeMonthlyUptime(incidents, months);

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Monthly Uptime — Last {months} Months
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis dataKey="month" tick={{ fill: "#8892a4", fontSize: 12 }} />
          <YAxis
            domain={[99, 100]}
            tick={{ fill: "#8892a4", fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, color: "#e2e8f0" }}
            formatter={(value: number) => [`${value.toFixed(4)}%`, "Uptime"]}
          />
          <Line
            type="monotone"
            dataKey="uptime"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create IncidentList component**

Create `src/components/IncidentList.tsx`:

```tsx
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
```

- [ ] **Step 3: Create the provider detail page**

Create `src/pages/provider/[name].astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import UptimeTrend from "../../components/UptimeTrend";
import IncidentList from "../../components/IncidentList";
import { getProviderIncidents, uptimeScores, PROVIDER_META } from "../../lib/data";
import type { GetStaticPaths } from "astro";

export const getStaticPaths: GetStaticPaths = () => {
  return [
    { params: { name: "aws" } },
    { params: { name: "azure" } },
    { params: { name: "gcp" } },
  ];
};

const { name } = Astro.params;
const provider = name as "aws" | "azure" | "gcp";
const meta = PROVIDER_META[provider];
const incidents = getProviderIncidents(provider);
const scores = uptimeScores.providers[provider];
const base = import.meta.env.BASE_URL;

const CATEGORIES = [
  "compute", "storage", "networking", "database", "ai-ml",
  "security", "analytics", "devtools", "messaging", "management",
];
---

<Base title={meta.name}>
  <h1 class="page-title" style={`color: ${meta.color}`}>{meta.name}</h1>

  <div class="trend-section">
    <UptimeTrend
      client:load
      incidents={incidents.map((inc) => ({
        startedAt: inc.startedAt,
        durationMinutes: inc.durationMinutes,
      }))}
      color={meta.color}
      months={12}
    />
  </div>

  <div class="category-section">
    <div class="category-card">
      <h3>Uptime by Category (90-day)</h3>
      <div class="category-table">
        {CATEGORIES.map((cat) => {
          const val = scores?.byCategory?.[cat]?.["90d"];
          const color = val === undefined ? "#8892a4"
            : val >= 99.95 ? "#10b981"
            : val >= 99.9 ? "#f59e0b"
            : "#ef4444";
          return (
            <div class="category-row">
              <span class="category-name">{cat}</span>
              <span class="category-value" style={`color: ${color}`}>
                {val !== undefined ? `${val.toFixed(2)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>

  <div class="incidents-section">
    <IncidentList
      client:load
      incidents={incidents.map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        startedAt: inc.startedAt,
        durationMinutes: inc.durationMinutes,
        affectedServices: inc.affectedServices.map((s) => ({
          serviceName: s.serviceName,
          category: s.category,
        })),
      }))}
      baseUrl={base}
    />
  </div>
</Base>

<style>
  .page-title { font-size: 1.5rem; margin-bottom: 1.5rem; }
  .trend-section { margin-bottom: 2rem; }
  .category-section { margin-bottom: 2rem; }

  .category-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .category-card h3 { font-size: 0.95rem; margin-bottom: 1rem; }

  .category-table { font-size: 0.85rem; }

  .category-row {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }

  .category-row:last-child { border-bottom: none; }
  .category-name { color: var(--text-muted); }
  .category-value { font-weight: 600; font-variant-numeric: tabular-nums; }

  .incidents-section { margin-bottom: 2rem; }
</style>
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:4321/cloud-historic-uptime/provider/aws`. Verify: uptime trend chart renders, category table shows, incident list with filters works. Check `/provider/azure` and `/provider/gcp` too.

- [ ] **Step 5: Commit**

```bash
git add src/components/UptimeTrend.tsx src/components/IncidentList.tsx src/pages/provider/
git commit -m "feat: add provider detail page with uptime trend and filterable incident list"
```

---

### Task 13: Compare Page + Category Bar Chart

**Files:**
- Create: `src/components/CategoryBar.tsx`
- Create: `src/pages/compare.astro`

- [ ] **Step 1: Create CategoryBar component**

Create `src/components/CategoryBar.tsx`:

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface CategoryBarProps {
  scores: Record<
    string,
    { byCategory: Record<string, Record<string, number>> }
  >;
  period: string;
}

const CATEGORIES = [
  "compute",
  "storage",
  "networking",
  "database",
  "ai-ml",
  "security",
];

export default function CategoryBar({ scores, period }: CategoryBarProps) {
  const data = CATEGORIES.map((cat) => ({
    category: cat,
    AWS: scores.aws?.byCategory?.[cat]?.[period] ?? 100,
    Azure: scores.azure?.byCategory?.[cat]?.[period] ?? 100,
    GCP: scores.gcp?.byCategory?.[cat]?.[period] ?? 100,
  }));

  return (
    <div style={{ background: "#1a1d2e", borderRadius: 8, padding: "1.25rem", border: "1px solid #2a2d3e" }}>
      <h3 style={{ color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "1rem" }}>
        Uptime by Category ({period})
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis dataKey="category" tick={{ fill: "#8892a4", fontSize: 12 }} />
          <YAxis
            domain={[99, 100]}
            tick={{ fill: "#8892a4", fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, color: "#e2e8f0" }}
            formatter={(value: number) => [`${value.toFixed(4)}%`]}
          />
          <Legend wrapperStyle={{ color: "#8892a4", fontSize: "0.8rem" }} />
          <Bar dataKey="AWS" fill="#ff9900" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Azure" fill="#0078d4" radius={[2, 2, 0, 0]} />
          <Bar dataKey="GCP" fill="#4285f4" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create the compare page**

Create `src/pages/compare.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import CategoryBar from "../components/CategoryBar";
import { uptimeScores, PROVIDER_META } from "../lib/data";

const scores = uptimeScores.providers;

const headToHead = [
  {
    category: "Compute",
    services: [
      { provider: "aws", name: "Amazon EC2" },
      { provider: "azure", name: "Azure Virtual Machines" },
      { provider: "gcp", name: "Compute Engine" },
    ],
  },
  {
    category: "Storage",
    services: [
      { provider: "aws", name: "Amazon S3" },
      { provider: "azure", name: "Blob Storage" },
      { provider: "gcp", name: "Cloud Storage" },
    ],
  },
  {
    category: "Database",
    services: [
      { provider: "aws", name: "Amazon RDS" },
      { provider: "azure", name: "Azure SQL Database" },
      { provider: "gcp", name: "Cloud SQL" },
    ],
  },
];
---

<Base title="Compare Providers">
  <h1 class="page-title">Cross-Provider Comparison</h1>

  <div class="chart-section">
    <CategoryBar client:load scores={scores} period="90d" />
  </div>

  <h2 class="section-title">Head-to-Head</h2>

  {headToHead.map((matchup) => (
    <div class="matchup">
      <h3 class="matchup-title">{matchup.category}</h3>
      <div class="matchup-grid">
        {matchup.services.map((svc) => {
          const meta = PROVIDER_META[svc.provider as keyof typeof PROVIDER_META];
          const catKey = matchup.category.toLowerCase().replace("/", "-");
          const val = scores[svc.provider as keyof typeof scores]?.byCategory?.[catKey]?.["90d"];
          const color = val === undefined ? "#8892a4"
            : val >= 99.95 ? "#10b981"
            : val >= 99.9 ? "#f59e0b"
            : "#ef4444";
          return (
            <div class="matchup-card">
              <div class="matchup-provider" style={`color: ${meta.color}`}>{svc.name}</div>
              <div class="matchup-score" style={`color: ${color}`}>
                {val !== undefined ? `${val.toFixed(2)}%` : "—"}
              </div>
              <div class="matchup-label">90-day uptime</div>
            </div>
          );
        })}
      </div>
    </div>
  ))}
</Base>

<style>
  .page-title { font-size: 1.5rem; margin-bottom: 1.5rem; }
  .chart-section { margin-bottom: 2.5rem; }
  .section-title { font-size: 1.1rem; margin-bottom: 1.25rem; }

  .matchup { margin-bottom: 1.5rem; }
  .matchup-title { font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-muted); }

  .matchup-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .matchup-card {
    flex: 1;
    min-width: 150px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .matchup-provider { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; }
  .matchup-score { font-size: 1.5rem; font-weight: 700; }
  .matchup-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
</style>
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:4321/cloud-historic-uptime/compare`. Verify: bar chart renders with 3 bars per category, head-to-head cards show for Compute/Storage/Database.

- [ ] **Step 4: Commit**

```bash
git add src/components/CategoryBar.tsx src/pages/compare.astro
git commit -m "feat: add compare page with category bar chart and head-to-head matchups"
```

---

### Task 14: Incident Detail Page

**Files:**
- Create: `src/pages/incident/[id].astro`

- [ ] **Step 1: Create the incident detail page**

Create `src/pages/incident/[id].astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import { getAllIncidents, PROVIDER_META, formatDuration } from "../../lib/data";
import type { GetStaticPaths } from "astro";

export const getStaticPaths: GetStaticPaths = () => {
  const incidents = getAllIncidents();
  return incidents.map((inc) => ({
    params: { id: inc.id },
    props: { incident: inc },
  }));
};

const { incident } = Astro.props;
const meta = PROVIDER_META[incident.provider];

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  minor: { bg: "#422006", text: "#f59e0b" },
  major: { bg: "#431407", text: "#ea580c" },
  critical: { bg: "#3b0000", text: "#ef4444" },
};
const sevStyle = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.minor;
---

<Base title={incident.title}>
  <div class="badges">
    <span class="badge" style={`color: ${meta.color}; background: ${meta.color}22;`}>
      {meta.name}
    </span>
    <span class="badge" style={`color: ${sevStyle.text}; background: ${sevStyle.bg};`}>
      {incident.severity.toUpperCase()}
    </span>
  </div>

  <h1 class="incident-title">{incident.title}</h1>

  <div class="incident-meta">
    {new Date(incident.startedAt).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    })}
    {" · "}
    {new Date(incident.startedAt).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
    })}
    {incident.resolvedAt && (
      <>
        {" – "}
        {new Date(incident.resolvedAt).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
        })}
      </>
    )}
    {" · Duration: "}
    {formatDuration(incident.durationMinutes)}
  </div>

  <div class="card">
    <h3>Affected Services</h3>
    <div class="service-tags">
      {incident.affectedServices.map((svc) => (
        <span class="service-tag">{svc.serviceName}</span>
      ))}
    </div>
  </div>

  {incident.updates.length > 0 && (
    <div class="card">
      <h3>Timeline</h3>
      <div class="timeline">
        {incident.updates.map((update, i) => {
          const isLast = i === incident.updates.length - 1;
          const time = new Date(update.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", timeZone: "UTC",
          });
          return (
            <div class="timeline-entry">
              <div class="timeline-time" style={`color: ${isLast ? "#10b981" : i === 0 ? "#ef4444" : "#f59e0b"}`}>
                {time}
              </div>
              <div class="timeline-message">{update.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  )}

  <div class="source-link">
    <a href={incident.sourceUrl} target="_blank" rel="noopener noreferrer">
      View on official status page →
    </a>
  </div>
</Base>

<style>
  .badges { display: flex; gap: 0.5rem; margin-bottom: 1rem; }

  .badge {
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 4px;
    font-weight: 600;
  }

  .incident-title { font-size: 1.35rem; margin-bottom: 0.5rem; }

  .incident-meta {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 2rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .card h3 { font-size: 0.95rem; margin-bottom: 0.75rem; }

  .service-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }

  .service-tag {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: #252535;
    padding: 4px 10px;
    border-radius: 4px;
  }

  .timeline { border-left: 2px solid var(--border); padding-left: 1.25rem; }

  .timeline-entry { margin-bottom: 1rem; }
  .timeline-entry:last-child { margin-bottom: 0; }

  .timeline-time {
    font-size: 0.85rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .timeline-message {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-top: 0.15rem;
  }

  .source-link {
    margin-top: 2rem;
    font-size: 0.85rem;
  }
</style>
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

If you have scraped data, click on any incident from the dashboard. Verify: badges render, timeline shows, affected services display as tags, source link works. If no data, verify the page builds without errors: `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/incident/
git commit -m "feat: add incident detail page with timeline and service tags"
```

---

### Task 15: About Page

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create the about page**

Create `src/pages/about.astro`:

```astro
---
import Base from "../layouts/Base.astro";
---

<Base title="About" description="How Cloud Historic Uptime collects data and calculates uptime scores.">
  <h1 class="page-title">Methodology & Data Sources</h1>

  <div class="card">
    <h2>Data Sources</h2>
    <p>All data comes from official cloud provider status pages:</p>
    <table class="data-table">
      <thead>
        <tr><th>Provider</th><th>Source</th><th>Method</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Google Cloud</td>
          <td><a href="https://status.cloud.google.com/incidents.json" target="_blank" rel="noopener">status.cloud.google.com/incidents.json</a></td>
          <td>JSON feed — fetched directly</td>
        </tr>
        <tr>
          <td>AWS</td>
          <td><a href="https://health.aws.amazon.com/health/status" target="_blank" rel="noopener">health.aws.amazon.com</a></td>
          <td>JSON events API</td>
        </tr>
        <tr>
          <td>Azure</td>
          <td><a href="https://azure.status.microsoft/en-us/status/history/" target="_blank" rel="noopener">azure.status.microsoft</a></td>
          <td>HTML scraping of Post Incident Reviews</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Uptime Calculation</h2>
    <p>For a given time window (e.g., 90 days):</p>
    <code class="formula">
      uptime% = (total_minutes − incident_minutes) / total_minutes × 100
    </code>
    <p>Per-category scores only count incidents affecting services in that category. Scores are recomputed daily at build time.</p>
  </div>

  <div class="card">
    <h2>Severity Mapping</h2>
    <ul>
      <li><strong>Google Cloud:</strong> Uses the <code>severity</code> field from the JSON feed — <code>high</code> → critical, <code>medium</code> → major, <code>low</code> → minor.</li>
      <li><strong>AWS:</strong> Derived from the event status code — 3 → critical, 2 → major, 1 → minor.</li>
      <li><strong>Azure:</strong> Inferred from narrative text using keyword matching (e.g., "outage" → critical, "degradation" → major) combined with the number of affected services. This is the most heuristic-heavy mapping.</li>
    </ul>
  </div>

  <div class="card">
    <h2>Known Limitations</h2>
    <ul>
      <li>Cloud providers may not publicly report all incidents. This data reflects only what appears on official status pages.</li>
      <li>Azure data is extracted from narrative HTML, which is less reliable than structured JSON feeds.</li>
      <li>Uptime percentages are <strong>estimates</strong> based on reported incident durations. Actual SLA performance as experienced by customers may differ.</li>
      <li>Service category mappings are manually maintained and may not cover every service.</li>
    </ul>
  </div>

  <div class="card">
    <h2>Collection Frequency</h2>
    <p>A GitHub Actions workflow runs daily at 06:00 UTC, executing the scrapers, merging new data, and redeploying the site. Data can also be collected manually via <code>npm run collect</code>.</p>
  </div>

  <div class="card">
    <h2>Open Source</h2>
    <p>This project is fully open source. You can audit the scrapers, data pipeline, and every data point in the repository:</p>
    <p><a href="https://github.com/YOUR_USERNAME/cloud-historic-uptime" target="_blank" rel="noopener">View on GitHub →</a></p>
  </div>
</Base>

<style>
  .page-title { font-size: 1.5rem; margin-bottom: 1.5rem; }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .card h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
  .card p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.75rem; }
  .card p:last-child { margin-bottom: 0; }
  .card ul { color: var(--text-muted); font-size: 0.9rem; padding-left: 1.25rem; }
  .card li { margin-bottom: 0.5rem; }
  .card code { color: var(--text); font-size: 0.85rem; }

  .formula {
    display: block;
    background: #0f1117;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--green);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  .data-table th {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    font-weight: 600;
  }

  .data-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
  }
</style>
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:4321/cloud-historic-uptime/about`. Verify: all sections render, links work, formula displays correctly.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: add about page with methodology, data sources, and limitations"
```

---

## Phase 4: Deployment

### Task 16: GitHub Actions Workflows

**Files:**
- Create: `.github/workflows/collect.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the data collection workflow**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/collect.yml`:

```yaml
name: Collect Incident Data

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run collect

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          if git diff --staged --quiet; then
            echo "No data changes"
          else
            git commit -m "chore: update incident data [$(date -u +%Y-%m-%d)]"
            git push
          fi
```

- [ ] **Step 2: Create the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "data/**"
      - "src/**"
      - "astro.config.mjs"
      - "package.json"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "feat: add GitHub Actions for daily data collection and Pages deployment"
```

---

### Task 17: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md`:

```markdown
# Cloud Historic Uptime

Historical uptime comparison for **AWS**, **Microsoft Azure**, and **Google Cloud** — based on publicly reported incidents from official status pages.

**[View the live site →](https://YOUR_USERNAME.github.io/cloud-historic-uptime/)**

## What's Tracked

Incident data is collected daily from each provider's official status page and normalized into a common format. Services are grouped into categories (Compute, Storage, Networking, Database, AI/ML, Security, Analytics, DevTools, Messaging, Management) for cross-provider comparison.

## Data Sources

| Provider | Source | Format |
|----------|--------|--------|
| Google Cloud | [status.cloud.google.com/incidents.json](https://status.cloud.google.com/incidents.json) | Structured JSON |
| AWS | [health.aws.amazon.com](https://health.aws.amazon.com/health/status) | JSON events API |
| Azure | [azure.status.microsoft](https://azure.status.microsoft/en-us/status/history/) | HTML (Post Incident Reviews) |

## Methodology

Uptime percentages are calculated as:

```
uptime% = (total_minutes - incident_minutes) / total_minutes × 100
```

Per-category scores only count incidents affecting services in that category. See the [About page](https://YOUR_USERNAME.github.io/cloud-historic-uptime/about) for full methodology details.

## Disclaimer

This project is **not affiliated** with Amazon Web Services, Microsoft, or Google. Uptime scores are **calculated estimates** based on publicly reported incidents. Actual SLA performance as experienced by customers may differ. Providers may not publicly report all incidents.

## Running Locally

```bash
npm install
npm run dev          # Start dev server
npm run collect      # Run scrapers to fetch latest data
npm run build        # Build static site
```

## Contributing

Contributions welcome! Common tasks:

- **Fix a scraper**: If a provider changes their status page format, update the relevant file in `scrapers/`.
- **Add service mappings**: Edit `data/service-map.json` to categorize newly launched services.
- **Add a provider**: Create a new scraper in `scrapers/`, add to `scrapers/run.ts`, and update the frontend.

## License

MIT
```

- [ ] **Step 2: Verify full build**

```bash
npm run build
```

Expected: Build succeeds with no errors. All pages are generated in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project README with setup, methodology, and contributing guide"
```

---

## Completion Checklist

After all tasks, verify:

- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all scraper tests pass
- [ ] `npm run dev` — all pages render correctly in browser
- [ ] Dashboard: score cards, heatmap, recent incidents
- [ ] Provider pages: uptime trend chart, category table, filterable incident list
- [ ] Compare page: category bar chart, head-to-head matchups
- [ ] Incident detail: badges, timeline, affected services, source link
- [ ] About page: methodology, data sources, limitations, disclaimer
- [ ] Nav links work across all pages
- [ ] Footer disclaimer appears on every page
- [ ] `npm run collect` fetches data (GCP should work; AWS/Azure may need selector tuning)
