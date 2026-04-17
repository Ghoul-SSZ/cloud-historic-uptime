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
