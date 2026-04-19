import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwsIncidents, normalizeHistoryData } from "./aws";
import type { AwsRawEvent, AwsHistoryData } from "./types";

function utf16Response(data: unknown): Response {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const utf16 = new Uint8Array(encoded.length * 2 + 2);
  utf16[0] = 0xfe; // BOM (big-endian)
  utf16[1] = 0xff;
  for (let i = 0; i < encoded.length; i++) {
    utf16[2 + i * 2] = 0;
    utf16[2 + i * 2 + 1] = encoded[i];
  }
  return new Response(utf16);
}

const mockLiveEvents: AwsRawEvent[] = [
  {
    service: "S3",
    region: "us-east-1",
    typeCode: "AWS_S3_OPERATIONAL_ISSUE",
    startTime: 1736935200000,
    endTime: 1736938020000,
    lastUpdatedTime: 1736938020000,
    metadata: {
      EVENT_LOG: JSON.stringify([
        {
          summary: "Elevated error rates on S3",
          message:
            "We are investigating elevated 5xx error rates for S3 in us-east-1.",
          status: 2,
          timestamp: 1736935200,
        },
        {
          summary: "Issue resolved",
          message: "S3 error rates have returned to normal levels.",
          status: 0,
          timestamp: 1736938020,
        },
      ]),
    },
  },
];

const mockHistoryData: AwsHistoryData = {
  "ec2-us-west-2": [
    {
      summary: "[RESOLVED] Increased Error Rates",
      arn: "arn:aws:health:us-west-2::event/EC2/AWS_EC2_OPERATIONAL_ISSUE/AWS_EC2_ISSUE_ABC123",
      status: "2",
      date: "1718200000",
      event_log: [
        {
          summary: "Increased Error Rates",
          message: "We are investigating increased error rates.",
          status: 2,
          timestamp: 1718200000,
        },
        {
          summary: "[RESOLVED] Increased Error Rates",
          message: "The issue has been resolved.",
          status: 0,
          timestamp: 1718210000,
        },
      ],
      impacted_services: {
        "ec2-us-west-2": {
          service_name: "Amazon EC2",
          current: "0",
          max: "2",
        },
        "ebs-us-west-2": {
          service_name: "Amazon EBS",
          current: "0",
          max: "1",
        },
      },
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAwsIncidents", () => {
  it("fetches from both live and history endpoints and merges", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("public/events")) {
        return utf16Response(mockLiveEvents);
      }
      if (u.includes("historyevents.json")) {
        return new Response(JSON.stringify(mockHistoryData));
      }
      return new Response("", { status: 404 });
    });

    const incidents = await fetchAwsIncidents();

    // Should have 2 incidents: one from live, one from history
    expect(incidents).toHaveLength(2);
    expect(incidents.some((i) => i.title === "Elevated error rates on S3")).toBe(
      true
    );
    expect(
      incidents.some((i) => i.title === "Increased Error Rates")
    ).toBe(true);
  });
});

describe("normalizeHistoryData", () => {
  it("normalizes S3 history events with impacted services", () => {
    const incidents = normalizeHistoryData(mockHistoryData);

    expect(incidents).toHaveLength(1);
    const inc = incidents[0];
    expect(inc.provider).toBe("aws");
    expect(inc.title).toBe("Increased Error Rates");
    expect(inc.severity).toBe("major");
    expect(inc.status).toBe("resolved");
    expect(inc.startedAt).toBe("2024-06-12T13:46:40.000Z");
    expect(inc.resolvedAt).toBe("2024-06-12T16:33:20.000Z");
    expect(inc.affectedServices).toHaveLength(2);
    expect(inc.affectedServices[0]).toEqual({
      serviceName: "Amazon EC2",
      category: "compute",
      regions: ["us-west-2"],
    });
    expect(inc.affectedServices[1]).toEqual({
      serviceName: "Amazon EBS",
      category: "storage",
      regions: ["us-west-2"],
    });
    expect(inc.updates).toHaveLength(2);
  });

  it("handles ongoing history events", () => {
    const ongoing: AwsHistoryData = {
      "bedrock-us-east-1": [
        {
          summary: "Increased Error Rates",
          arn: "arn:aws:health:us-east-1::event/BEDROCK/ISSUE/XYZ",
          status: "1",
          date: "1718200000",
          event_log: [
            {
              summary: "Increased Error Rates",
              message: "Investigating.",
              status: 1,
              timestamp: 1718200000,
            },
          ],
        },
      ],
    };

    const incidents = normalizeHistoryData(ongoing);
    expect(incidents[0].status).toBe("ongoing");
    expect(incidents[0].resolvedAt).toBeNull();
    expect(incidents[0].durationMinutes).toBeNull();
    expect(incidents[0].affectedServices[0].serviceName).toBe("Amazon Bedrock");
  });

  it("deduplicates events with same ARN across service keys", () => {
    const duped: AwsHistoryData = {
      "bedrock-us-east-1": [
        {
          summary: "[RESOLVED] API issues",
          arn: "arn:aws:health::event/BEDROCK/ISSUE/SAME_ID",
          status: "2",
          date: "1718200000",
          event_log: [
            { summary: "API issues", message: "Investigating.", status: 2, timestamp: 1718200000 },
            { summary: "Resolved", message: "Fixed.", status: 0, timestamp: 1718210000 },
          ],
        },
      ],
      "bedrock-us-west-2": [
        {
          summary: "[RESOLVED] API issues",
          arn: "arn:aws:health::event/BEDROCK/ISSUE/SAME_ID",
          status: "2",
          date: "1718200000",
          event_log: [
            { summary: "API issues", message: "Investigating.", status: 2, timestamp: 1718200000 },
            { summary: "Resolved", message: "Fixed.", status: 0, timestamp: 1718210000 },
          ],
        },
      ],
    };

    const incidents = normalizeHistoryData(duped);
    expect(incidents).toHaveLength(1);
  });
});
