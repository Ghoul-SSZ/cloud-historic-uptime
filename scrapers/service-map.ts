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
  if (providerMap[serviceName]) return providerMap[serviceName];
  // Try stripping common prefixes (Azure PIRs use "Azure App Service" but map has "App Service")
  for (const prefix of ["Azure ", "Microsoft ", "Amazon ", "AWS ", "Google "]) {
    if (serviceName.startsWith(prefix)) {
      const stripped = serviceName.slice(prefix.length);
      if (providerMap[stripped]) return providerMap[stripped];
    }
  }
  return "other";
}
