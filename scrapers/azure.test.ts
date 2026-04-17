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
