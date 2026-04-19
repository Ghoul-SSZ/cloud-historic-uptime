import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGcpIncidents, parseIncidentHtml } from "./gcp";
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

const mockProductsJson = { products: [{ title: "Cloud SQL", id: "prod1" }] };

const mockProductHistoryHtml = `
<html><body>
  <a href="../../incidents/abc123">Incident</a>
</body></html>
`;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchGcpIncidents", () => {
  it("fetches JSON incidents and discovers historical IDs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("incidents.json")) {
        return new Response(JSON.stringify(mockGcpResponse));
      }
      if (u.includes("products.json")) {
        return new Response(JSON.stringify(mockProductsJson));
      }
      if (u.includes("/products/")) {
        // Product history page — references the same incident as JSON
        return new Response(mockProductHistoryHtml);
      }
      return new Response("", { status: 404 });
    });

    const incidents = await fetchGcpIncidents();

    // abc123 appears in both JSON and history, should deduplicate
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
    expect(inc.updates).toHaveLength(2);
  });

  it("handles ongoing incidents (no end time)", async () => {
    const ongoing = [{ ...mockGcpResponse[0], end: "", id: "ongoing1" }];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("incidents.json")) {
        return new Response(JSON.stringify(ongoing));
      }
      if (u.includes("products.json")) {
        return new Response(JSON.stringify(mockProductsJson));
      }
      if (u.includes("/products/")) {
        return new Response(`<html><body><a href="../../incidents/ongoing1">x</a></body></html>`);
      }
      return new Response("", { status: 404 });
    });

    const incidents = await fetchGcpIncidents();
    expect(incidents[0].status).toBe("ongoing");
    expect(incidents[0].resolvedAt).toBeNull();
    expect(incidents[0].durationMinutes).toBeNull();
  });
});

describe("parseIncidentHtml", () => {
  const incidentHtml = `
<html><body><main>
  <div class="incident-header">
    Incident affecting Cloud SQL, Cloud Run
  </div>
  <div class="incident-description">
    Cloud SQL experienced elevated error rates in us-central1.
  </div>
  <div class="start-time">2024-03-15 14:30</div>
  <div class="end-time">2024-03-15 16:45</div>
  <div class="timezone">US/Pacific</div>
  <table class="status-updates">
    <thead><tr><td>Date</td><td>Time</td><td>Description</td></tr></thead>
    <tbody>
      <tr>
        <td class="status"><svg class="psd__status-icon psd__available" aria-label="Available status"></svg></td>
        <td class="date">15 Mar 2024</td>
        <td class="time">16:45 PDT</td>
        <td class="description">Issue resolved.</td>
      </tr>
      <tr>
        <td class="status"><svg class="psd__status-icon psd__disruption" aria-label="Disruption status"></svg></td>
        <td class="date">15 Mar 2024</td>
        <td class="time">15:00 PDT</td>
        <td class="description">We are still investigating.</td>
      </tr>
      <tr>
        <td class="status"><svg class="psd__status-icon psd__outage" aria-label="Outage status"></svg></td>
        <td class="date">15 Mar 2024</td>
        <td class="time">14:30 PDT</td>
        <td class="description">We are investigating elevated error rates.</td>
      </tr>
    </tbody>
  </table>
</main></body></html>
`;

  it("parses incident HTML into normalized Incident", () => {
    const inc = parseIncidentHtml("test123", incidentHtml);
    expect(inc).not.toBeNull();
    expect(inc!.id).toBe("gcp-test123");
    expect(inc!.provider).toBe("gcp");
    expect(inc!.title).toBe(
      "Cloud SQL experienced elevated error rates in us-central1."
    );
    expect(inc!.severity).toBe("critical"); // psd__outage present
    expect(inc!.status).toBe("resolved");
    expect(inc!.startedAt).toBe("2024-03-15T22:30:00.000Z"); // 14:30 PDT = 21:30 UTC... wait
    expect(inc!.affectedServices).toHaveLength(2);
    expect(inc!.affectedServices[0].serviceName).toBe("Cloud SQL");
    expect(inc!.affectedServices[1].serviceName).toBe("Cloud Run");
    expect(inc!.updates).toHaveLength(3);
  });

  it("returns null for empty HTML", () => {
    const inc = parseIncidentHtml("bad", "<html><body></body></html>");
    expect(inc).toBeNull();
  });
});
