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
