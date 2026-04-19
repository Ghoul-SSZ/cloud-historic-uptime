import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAzureIncidents, parseAzureHistoryHtml } from "./azure";

const mockHtml = `
<html><body>
<input class="wa-historyResult-count" value="1" />
<div class="incident-history-item">
  <button class="incident-history-header">
    <span class="hide-text">02/07/2026</span>
    <div class="incident-history-title">
      Post Incident Review (PIR) – Power event impacting multiple services – West US
    </div>
    <div class="incident-history-tracking-id">
      Tracking ID: _SVS-5_G
    </div>
  </button>
  <div class="incident-history-collapse">
    <div class="card-body">
      <p>What happened?</p>
      <p>Between 07:58 UTC on 07 February 2026 and 04:24 UTC on 08 February 2026,
        impacted customers experienced intermittent service unavailability in the West US region.</p>
      <p>Impacted services included:</p>
      <ul>
        <li><strong>Azure App Service:</strong> Customers using Azure App Service in West US experienced failures.</li>
        <li><strong>Azure Cache for Redis:</strong> Customers may have observed connectivity failures.</li>
        <li><strong>Azure Cosmos DB:</strong> Customers experienced intermittent connectivity issues.</li>
      </ul>
      <p>How did we respond?</p>
      <ul>
        <li>07:54 UTC on 07 February 2026 \u2013 Initial electrical failure in an onsite transformer.</li>
        <li>07:58 UTC on 07 February 2026 \u2013 Customers began experiencing unavailability.</li>
        <li>09:31 UTC on 07 February 2026 \u2013 Power was restored to 90% of IT racks.</li>
        <li>04:24 UTC on 08 February 2026 \u2013 All services confirmed fully recovered.</li>
      </ul>
    </div>
  </div>
</div>
</body></html>
`;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("parseAzureHistoryHtml", () => {
  it("extracts incidents from Azure history API HTML", () => {
    const incidents = parseAzureHistoryHtml(mockHtml);

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.id).toBe("azure-_SVS-5_G");
    expect(inc.provider).toBe("azure");
    expect(inc.title).toContain("Power event impacting multiple services");
    expect(inc.severity).toBe("major");
    expect(inc.status).toBe("resolved");
    expect(inc.startedAt).toBe("2026-02-07T07:54:00.000Z");
    expect(inc.resolvedAt).toBe("2026-02-08T04:24:00.000Z");
    expect(inc.durationMinutes).toBe(1230);
    expect(inc.affectedServices).toHaveLength(3);
    expect(inc.affectedServices[0]).toEqual({
      serviceName: "Azure App Service",
      category: "compute",
      regions: ["West US"],
    });
    expect(inc.affectedServices[1].serviceName).toBe("Azure Cache for Redis");
    expect(inc.affectedServices[2].serviceName).toBe("Azure Cosmos DB");
    expect(inc.description).toContain("07:58 UTC on 07 February 2026");
    expect(inc.updates).toHaveLength(4);
    expect(inc.updates[0].timestamp).toBe("2026-02-07T07:54:00.000Z");
    expect(inc.updates[0].message).toContain("Initial electrical failure");
  });

  it("returns empty array for HTML with no incidents", () => {
    const incidents = parseAzureHistoryHtml("<html><body></body></html>");
    expect(incidents).toEqual([]);
  });
});

describe("fetchAzureIncidents", () => {
  it("fetches and parses Azure status history API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(mockHtml)
    );

    const incidents = await fetchAzureIncidents();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].provider).toBe("azure");
  });
});
