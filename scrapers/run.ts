import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fetchGcpIncidents } from "./gcp";
import { fetchAwsIncidents } from "./aws";
import { fetchAzureIncidents } from "./azure";
import { computeUptimeScores } from "./compute-uptime";
import type { Incident, Provider } from "./types";

const DATA_DIR = join(import.meta.dirname, "../data");
const INCIDENTS_DIR = join(DATA_DIR, "incidents");
const COMPUTED_DIR = join(DATA_DIR, "computed");

function loadExisting(provider: Provider): Incident[] {
  try {
    const raw = readFileSync(
      join(INCIDENTS_DIR, `${provider}.json`),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mergeIncidents(
  existing: Incident[],
  fresh: Incident[]
): Incident[] {
  const byId = new Map<string, Incident>();
  for (const inc of existing) byId.set(inc.id, inc);
  for (const inc of fresh) byId.set(inc.id, inc);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

async function runScraper(
  name: string,
  fetcher: () => Promise<Incident[]>,
  provider: Provider
): Promise<Incident[]> {
  console.log(`[${name}] Fetching incidents...`);
  try {
    const fresh = await fetcher();
    console.log(`[${name}] Got ${fresh.length} incidents`);
    const existing = loadExisting(provider);
    const merged = mergeIncidents(existing, fresh);
    console.log(
      `[${name}] Merged: ${existing.length} existing + ${fresh.length} new = ${merged.length} total`
    );
    return merged;
  } catch (err) {
    console.error(`[${name}] Failed:`, err);
    return loadExisting(provider);
  }
}

async function main() {
  mkdirSync(INCIDENTS_DIR, { recursive: true });
  mkdirSync(COMPUTED_DIR, { recursive: true });

  const [awsIncidents, azureIncidents, gcpIncidents] =
    await Promise.all([
      runScraper("AWS", fetchAwsIncidents, "aws"),
      runScraper("Azure", fetchAzureIncidents, "azure"),
      runScraper("GCP", fetchGcpIncidents, "gcp"),
    ]);

  writeFileSync(
    join(INCIDENTS_DIR, "aws.json"),
    JSON.stringify(awsIncidents, null, 2)
  );
  writeFileSync(
    join(INCIDENTS_DIR, "azure.json"),
    JSON.stringify(azureIncidents, null, 2)
  );
  writeFileSync(
    join(INCIDENTS_DIR, "gcp.json"),
    JSON.stringify(gcpIncidents, null, 2)
  );

  const allIncidents = [...awsIncidents, ...azureIncidents, ...gcpIncidents];
  const scores = computeUptimeScores(allIncidents);
  writeFileSync(
    join(COMPUTED_DIR, "uptime-scores.json"),
    JSON.stringify(scores, null, 2)
  );

  console.log(`Done. ${allIncidents.length} total incidents across all providers.`);
}

main();
