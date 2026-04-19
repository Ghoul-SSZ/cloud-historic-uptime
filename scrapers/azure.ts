import * as cheerio from "cheerio";
import type { Incident } from "./types";
import { lookupCategory } from "./service-map";
import {
  inferAzureSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const AZURE_HISTORY_API =
  "https://azure.status.microsoft/en-us/statushistoryapi/";

export async function fetchAzureIncidents(): Promise<Incident[]> {
  const incidents: Incident[] = [];
  let page = 1;

  while (true) {
    const url = `${AZURE_HISTORY_API}?serviceSlug=all&regionSlug=all&startDate=all&page=${page}&shdrefreshflag=true`;
    const response = await fetch(url);
    const html = await response.text();
    const parsed = parseAzureHistoryHtml(html);
    if (parsed.length === 0) break;
    incidents.push(...parsed);

    const $ = cheerio.load(html);
    const totalCount = parseInt($(".wa-historyResult-count").val() as string, 10) || 0;
    if (incidents.length >= totalCount) break;
    page++;
  }

  return incidents;
}

/** Parse UTC datetime from a timeline entry like "23:20 UTC on 09 March 2026" */
function parseTimelineDate(text: string): string | null {
  const match = text.match(
    /(\d{1,2}:\d{2})\s+UTC\s+on\s+(\d{1,2})\s+(\w+)\s+(\d{4})/
  );
  if (!match) return null;

  const [, time, day, monthName, year] = match;
  const months: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
  };
  const month = months[monthName];
  if (!month) return null;

  return `${year}-${month}-${day.padStart(2, "0")}T${time}:00.000Z`;
}

export function parseAzureHistoryHtml(html: string): Incident[] {
  const $ = cheerio.load(html);
  const incidents: Incident[] = [];

  $(".incident-history-item").each((_i, el) => {
    const item = $(el);

    const trackingRaw = item.find(".incident-history-tracking-id").text().trim();
    const trackingId = trackingRaw.replace("Tracking ID:", "").trim();
    if (!trackingId) return;

    const title = item.find(".incident-history-title").text().trim();
    if (!title) return;

    const body = item.find(".card-body");
    const bodyText = body.text();

    // Extract affected services from the "Impacted services" list
    const serviceNames: string[] = [];
    body.find("p").each((_j, p) => {
      const pText = $(p).text().trim().toLowerCase();
      if (pText.includes("impacted services")) {
        const ul = $(p).next("ul");
        ul.find("li").each((_k, li) => {
          const liText = $(li).text().trim();
          // Bold service names appear in format "Service Name: description" or "Service Name –"
          const boldText = $(li).find("strong, b").first().text().trim();
          if (boldText) {
            const name = boldText.replace(/:$/, "").trim();
            if (name) serviceNames.push(name);
          } else {
            // Fallback: take text before colon or dash
            const sepMatch = liText.match(/^(.+?)\s*[:\u2013\u2014-]\s/);
            if (sepMatch) serviceNames.push(sepMatch[1].trim());
          }
        });
      }
    });

    // If no explicit service list found, extract service from title
    if (serviceNames.length === 0) {
      // PIR format: "Post Incident Review (PIR) – Service Name – Region/description"
      const pirMatch = title.match(
        /PIR\)\s*[\u2013\u2014-]\s*(.+?)(?:\s*[\u2013\u2014-]\s|$)/
      );
      if (pirMatch) {
        serviceNames.push(pirMatch[1].trim());
      } else {
        // RCA/older format: "RCA - Azure SQL DB and Cosmos DB Unavailable"
        // or plain: "Virtual Machines - West US - Resolved"
        const rcaMatch = title.match(
          /^(?:RCA\s*[\u2013\u2014-]\s*)?(.+?)(?:\s*[\u2013\u2014-]\s+(?:[\w\s]+(?:Region|Resolved|Mitigated|Issues?|Failure|Error|Unavail|Outage|Degradat))|\s*$)/i
        );
        if (rcaMatch) {
          // Split on " and " or ", " to get individual service names
          const raw = rcaMatch[1].trim();
          const parts = raw.split(/\s+and\s+|,\s+/).map((s) => s.trim()).filter(Boolean);
          for (const part of parts) {
            // Only add if it looks like a service name (contains Azure/known keywords or starts with capital)
            if (/Azure|Virtual|SQL|Cosmos|Active Directory|App Service|Functions|Storage|IoT|Kubernetes|Front Door|DevOps|Entra|Office|Microsoft|Dynamics/i.test(part)) {
              serviceNames.push(part);
            }
          }
        }
      }
    }

    // Extract start/end times from "How did we respond?" timeline
    let startedAt: string | null = null;
    let resolvedAt: string | null = null;

    body.find("p").each((_j, p) => {
      const pText = $(p).text().trim().toLowerCase();
      if (pText.includes("how did we respond")) {
        const ul = $(p).next("ul");
        const lis = ul.find("li");
        if (lis.length > 0) {
          startedAt = parseTimelineDate($(lis.first()).text());
          resolvedAt = parseTimelineDate($(lis.last()).text());
        }
      }
    });

    // Fallback: try to extract dates from body text using "Between X and Y" pattern
    if (!startedAt) {
      const betweenMatch = bodyText.match(
        /(\d{1,2}:\d{2})\s+UTC\s+on\s+(\d{1,2}\s+\w+\s+\d{4})/
      );
      if (betweenMatch) {
        startedAt = parseTimelineDate(betweenMatch[0]);
      }
    }

    // Fallback: use the display date
    if (!startedAt) {
      const dateText = item.find(".hide-text").text().trim();
      if (dateText) {
        const parsed = new Date(dateText);
        if (!isNaN(parsed.getTime())) {
          startedAt = parsed.toISOString();
        }
      }
    }

    if (!startedAt) return;

    // Extract description from the paragraph after "What happened?"
    let description = "";
    body.find("p").each((_j, p) => {
      const pText = $(p).text().trim();
      if (pText.toLowerCase() === "what happened?") {
        const next = $(p).next("p").text().trim();
        if (next) description = next;
      }
    });
    if (!description) description = title;

    const affectedServices = serviceNames.map((name) => ({
      serviceName: name,
      category: lookupCategory("azure", name),
      regions: extractRegions(bodyText),
    }));

    incidents.push({
      id: makeIncidentId("azure", trackingId),
      provider: "azure",
      title,
      description,
      severity: inferAzureSeverity(description, serviceNames.length),
      status: "resolved", // PIRs are always post-incident (resolved)
      startedAt,
      resolvedAt,
      durationMinutes: computeDurationMinutes(startedAt, resolvedAt),
      affectedServices,
      updates: extractTimeline($, body),
      sourceUrl: `https://azure.status.microsoft/en-us/status/history/`,
    });
  });

  return incidents;
}

/** Extract region names from incident body text */
function extractRegions(text: string): string[] {
  const regionPatterns = [
    /\b(East US(?:\s+\d)?|West US(?:\s+\d)?|Central US|North Central US|South Central US|West Central US)\b/g,
    /\b(East Asia|Southeast Asia|Japan (?:East|West)|Australia (?:East|Southeast))\b/g,
    /\b(North Europe|West Europe|UK (?:South|West)|France (?:Central|South)|Germany (?:West Central|North))\b/g,
    /\b(Brazil South|Canada (?:Central|East)|Korea (?:Central|South))\b/g,
  ];
  const regions = new Set<string>();
  for (const pattern of regionPatterns) {
    for (const match of text.matchAll(pattern)) {
      regions.add(match[1]);
    }
  }
  return Array.from(regions);
}

/** Extract timeline entries from the "How did we respond?" section */
function extractTimeline(
  $: cheerio.CheerioAPI,
  body: cheerio.Cheerio<cheerio.Element>
): Incident["updates"] {
  const updates: Incident["updates"] = [];
  body.find("p").each((_j, p) => {
    const pText = $(p).text().trim().toLowerCase();
    if (pText.includes("how did we respond")) {
      $(p).next("ul").find("li").each((_k, li) => {
        const liText = $(li).text().trim();
        const timestamp = parseTimelineDate(liText);
        if (timestamp) {
          // Remove the date prefix to get the message
          const message = liText.replace(
            /\d{1,2}:\d{2}\s+UTC\s+on\s+\d{1,2}\s+\w+\s+\d{4}\s*[\u2013\u2014-]\s*/,
            ""
          ).trim();
          updates.push({ timestamp, status: "update", message });
        }
      });
    }
  });
  return updates;
}
