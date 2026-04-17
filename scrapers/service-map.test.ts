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

  it("handles exact matching only", () => {
    expect(lookupCategory("aws", "Amazon EC2 - Auto Scaling")).toBe("other");
    expect(lookupCategory("aws", "Amazon EC2")).toBe("compute");
  });
});
