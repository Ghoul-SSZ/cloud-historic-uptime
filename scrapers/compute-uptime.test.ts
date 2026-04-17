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
