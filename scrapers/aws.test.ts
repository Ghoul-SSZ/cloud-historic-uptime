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
