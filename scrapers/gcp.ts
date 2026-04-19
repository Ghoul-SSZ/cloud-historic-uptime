import * as cheerio from "cheerio";
import type { GcpRawIncident, Incident, Severity } from "./types";
import { lookupCategory } from "./service-map";
import {
  mapGcpSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const GCP_INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";
const GCP_PRODUCTS_URL = "https://status.cloud.google.com/products.json";
const GCP_BASE_URL = "https://status.cloud.google.com";
const CONCURRENCY = 20;

export async function fetchGcpIncidents(): Promise<Incident[]> {
  // Fetch JSON incidents (recent, have severity field) in parallel with
  // discovering all historical incident IDs from product history pages.
  const [jsonIncidents, allIds] = await Promise.all([
    fetchJsonIncidents(),
    discoverAllIncidentIds(),
  ]);

  // Build a map of JSON incidents by ID so we can prefer their richer data
  const jsonMap = new Map<string, Incident>();
  for (const inc of jsonIncidents) {
    jsonMap.set(inc.id, inc);
  }

  // Find IDs not covered by JSON
  const jsonRawIds = new Set(jsonIncidents.map((i) => i.id.replace("gcp-", "")));
  const htmlIds = allIds.filter((id) => !jsonRawIds.has(id));

  console.log(
    `[GCP] ${jsonIncidents.length} from JSON, ${htmlIds.length} to scrape from HTML`
  );

  // Fetch HTML incident pages in batches
  const htmlIncidents = await fetchIncidentPages(htmlIds);

  // Merge: JSON incidents take precedence
  const byId = new Map<string, Incident>();
  for (const inc of htmlIncidents) byId.set(inc.id, inc);
  for (const inc of jsonIncidents) byId.set(inc.id, inc);

  return Array.from(byId.values());
}

/** Fetch recent incidents from the JSON API (has severity field) */
async function fetchJsonIncidents(): Promise<Incident[]> {
  const response = await fetch(GCP_INCIDENTS_URL);
  const raw: GcpRawIncident[] = await response.json();
  return raw.map(normalizeGcpIncident);
}

/** Discover all historical incident IDs from product history pages */
async function discoverAllIncidentIds(): Promise<string[]> {
  const productsResp = await fetch(GCP_PRODUCTS_URL);
  const productsData = await productsResp.json();
  const productIds: string[] = productsData.products.map(
    (p: { id: string }) => p.id
  );

  const allIds = new Set<string>();
  await processInBatches(productIds, CONCURRENCY, async (pid) => {
    const resp = await fetch(
      `${GCP_BASE_URL}/products/${pid}/history`
    );
    const html = await resp.text();
    for (const m of html.matchAll(/incidents\/([a-zA-Z0-9]+)/g)) {
      allIds.add(m[1]);
    }
  });

  return Array.from(allIds);
}

/** Fetch and parse individual incident HTML pages */
async function fetchIncidentPages(ids: string[]): Promise<Incident[]> {
  const results: Incident[] = [];
  await processInBatches(ids, CONCURRENCY, async (id) => {
    try {
      const resp = await fetch(`${GCP_BASE_URL}/incidents/${id}`);
      if (!resp.ok) return;
      const html = await resp.text();
      const incident = parseIncidentHtml(id, html);
      if (incident) results.push(incident);
    } catch {
      // Skip individual failures
    }
  });
  return results;
}

/** Parse a GCP incident HTML page into a normalized Incident */
export function parseIncidentHtml(
  id: string,
  html: string
): Incident | null {
  const $ = cheerio.load(html);

  const description = $(".incident-description").text().trim();
  if (!description) return null;

  const startRaw = $(".start-time").text().trim();
  const endRaw = $(".end-time").text().trim();
  const tz = $(".timezone").text().trim() || "US/Pacific";

  const startedAt = parseGcpDate(startRaw, tz);
  if (!startedAt) return null;
  const resolvedAt = endRaw ? parseGcpDate(endRaw, tz) : null;

  // Extract affected products from header: "Incident affecting X, Y, Z"
  const headerText = $(".incident-header").text().trim();
  const affectingMatch = headerText.match(/affecting\s+(.+)/i);
  const productNames = affectingMatch
    ? affectingMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Parse status updates and determine severity from status icons
  const updates: Incident["updates"] = [];
  let worstSeverity: Severity = "minor";

  $(".status-updates tbody tr").each((_i, el) => {
    const row = $(el);
    const tds = row.find("td");
    if (tds.length < 4) return;

    const statusSvg = tds.eq(0).find("svg");
    const statusClass = statusSvg.attr("class") ?? "";
    const date = tds.eq(1).text().trim();
    const time = tds.eq(2).text().trim();
    const message = tds.eq(3).text().trim();

    const status = mapStatusIcon(statusClass);
    const timestamp = parseGcpDate(`${date} ${time.split(" ")[0]}`, tz);

    if (status === "outage" && worstSeverity !== "critical") {
      worstSeverity = "critical";
    } else if (status === "disruption" && worstSeverity === "minor") {
      worstSeverity = "major";
    }

    if (timestamp) {
      updates.push({
        timestamp,
        status,
        message,
      });
    }
  });

  return {
    id: makeIncidentId("gcp", id),
    provider: "gcp",
    title: description.length > 120 ? description.slice(0, 117) + "..." : description,
    description,
    severity: worstSeverity,
    status: resolvedAt ? "resolved" : "ongoing",
    startedAt,
    resolvedAt,
    durationMinutes: computeDurationMinutes(startedAt, resolvedAt),
    affectedServices: productNames.map((name) => ({
      serviceName: name,
      category: lookupCategory("gcp", name),
      regions: [],
    })),
    updates,
    sourceUrl: `${GCP_BASE_URL}/incidents/${id}`,
  };
}

/** Map SVG class to status string */
function mapStatusIcon(cls: string): string {
  if (cls.includes("outage")) return "outage";
  if (cls.includes("disruption")) return "disruption";
  if (cls.includes("information")) return "information";
  return "available";
}

/**
 * Parse GCP date strings like "2022-05-08 23:55" with a named timezone.
 * Returns ISO 8601 string.
 */
function parseGcpDate(raw: string, tz: string): string | null {
  if (!raw) return null;

  // Format: "YYYY-MM-DD HH:MM" or "DD Mon YYYY HH:MM TZ"
  // Also handles "8 Mar 2026 22:25 PDT" from update rows
  let dateStr = raw;

  // Normalize "DD Mon YYYY" → "YYYY-MM-DD" format
  const longMatch = dateStr.match(
    /(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{1,2}:\d{2})/
  );
  if (longMatch) {
    const [, day, mon, year, time] = longMatch;
    const months: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const m = months[mon];
    if (!m) return null;
    dateStr = `${year}-${m}-${day.padStart(2, "0")} ${time}`;
  }

  const match = dateStr.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (!match) return null;

  const [, datePart, timePart] = match;

  // Convert named timezone to UTC offset
  const offset = timezoneOffset(tz, raw);
  const dt = new Date(`${datePart}T${timePart.padStart(5, "0")}:00${offset}`);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/** Map GCP timezone name + optional abbreviation to UTC offset */
function timezoneOffset(tz: string, rawText: string): string {
  // Check for explicit abbreviation in the raw text
  if (rawText.includes("PDT")) return "-07:00";
  if (rawText.includes("PST")) return "-08:00";
  if (rawText.includes("EDT")) return "-04:00";
  if (rawText.includes("EST")) return "-05:00";
  if (rawText.includes("UTC") || rawText.includes("GMT")) return "+00:00";

  // Fall back to timezone name (assume standard time)
  const tzMap: Record<string, string> = {
    "US/Pacific": "-08:00",
    "US/Eastern": "-05:00",
    "US/Central": "-06:00",
    "US/Mountain": "-07:00",
    "Europe/London": "+00:00",
    "UTC": "+00:00",
  };
  return tzMap[tz] ?? "-08:00"; // Default to Pacific
}

function normalizeGcpIncident(raw: GcpRawIncident): Incident {
  const resolvedAt = raw.end || null;
  return {
    id: makeIncidentId("gcp", raw.id),
    provider: "gcp",
    title: raw.external_desc,
    description: raw.updates.at(-1)?.text ?? raw.external_desc,
    severity: mapGcpSeverity(raw.severity),
    status: resolvedAt ? "resolved" : "ongoing",
    startedAt: raw.begin,
    resolvedAt,
    durationMinutes: computeDurationMinutes(raw.begin, resolvedAt),
    affectedServices: raw.affected_products.map((p) => ({
      serviceName: p.title,
      category: lookupCategory("gcp", p.title),
      regions: [],
    })),
    updates: raw.updates.map((u) => ({
      timestamp: u.when,
      status: u.status,
      message: u.text,
    })),
    sourceUrl: `${GCP_BASE_URL}/incidents/${raw.id}`,
  };
}

/** Process items in batches with concurrency limit */
async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
  }
}
