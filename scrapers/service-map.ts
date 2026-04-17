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
