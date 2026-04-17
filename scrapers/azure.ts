import * as cheerio from "cheerio";
import type { Incident } from "./types";
import { lookupCategory } from "./service-map";
import {
  inferAzureSeverity,
  computeDurationMinutes,
  makeIncidentId,
} from "./normalize";

const AZURE_STATUS_URL =
  "https://azure.status.microsoft/en-us/status/history/";

export async function fetchAzureIncidents(): Promise<Incident[]> {
  const response = await fetch(AZURE_STATUS_URL);
  const html = await response.text();
  return parseAzurePirHtml(html);
}

export function parseAzurePirHtml(html: string): Incident[] {
  const $ = cheerio.load(html);
  const incidents: Incident[] = [];

  $(".event-row").each((_i, el) => {
    const row = $(el);
    const trackingId = row.attr("data-tracking-id");
    if (!trackingId) return;

    const title = row.find(".event-title").text().trim();
    const summary = row.find(".event-summary").text().trim();
    const startDate = row.find(".start-date").text().trim();
    const endDate = row.find(".end-date").text().trim();

    const serviceNames: string[] = [];
    row.find(".service-tag").each((_j, tag) => {
      serviceNames.push($(tag).text().trim());
    });

    if (!title || !startDate) return;

    const resolvedAt = endDate || null;

    incidents.push({
      id: makeIncidentId("azure", trackingId),
      provider: "azure",
      title,
      description: summary || title,
      severity: inferAzureSeverity(summary || title, serviceNames.length),
      status: resolvedAt ? "resolved" : "ongoing",
      startedAt: startDate,
      resolvedAt,
      durationMinutes: computeDurationMinutes(startDate, resolvedAt),
      affectedServices: serviceNames.map((name) => ({
        serviceName: name,
        category: lookupCategory("azure", name),
        regions: [],
      })),
      updates: [],
      sourceUrl: `https://azure.status.microsoft/en-us/status/history/#${trackingId}`,
    });
  });

  return incidents;
}
