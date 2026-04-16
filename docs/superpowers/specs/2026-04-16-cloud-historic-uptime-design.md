# Cloud Historic Uptime — Design Spec

A public reference site that visualizes historical uptime data for AWS, Azure, and Google Cloud, enabling side-by-side reliability comparison across the three major cloud providers.

Inspired by [github-historical-uptime](https://damrnelson.github.io/github-historical-uptime/).

## Goals

- Provide a free, public tool for comparing cloud provider reliability over time
- Cover 1-2 years of historical incident data
- Present both incident-level detail and aggregated uptime scores
- Be fully transparent about data sources and methodology
- Run entirely on free infrastructure (GitHub Pages + Actions)

## Architecture

Four-stage pipeline:

1. **Data Sources** — official provider status pages/APIs
2. **Scrapers** — one TypeScript scraper per provider, normalizing into a common schema
3. **Normalized Data** — JSON files committed to the repo
4. **Astro Site** — static pages with React chart islands for interactivity

Two GitHub Actions workflows:

- `collect.yml` — daily cron, runs scrapers, commits updated data
- `deploy.yml` — on data/source changes, builds Astro site, deploys to GitHub Pages

## Data Sources

| Provider | URL | Format | Strategy |
|----------|-----|--------|----------|
| **GCP** | `status.cloud.google.com/incidents.json` | Structured JSON with severity, affected products, timestamps | Fetch and normalize directly |
| **AWS** | `health.aws.amazon.com/public/events` | JSON with services, regions, event logs | Fetch JSON endpoint; one-time HTML scrape of status history for backfill |
| **Azure** | `azure.status.microsoft/en-us/status/history/` | Narrative HTML Post Incident Reviews | Scrape HTML with Cheerio, extract dates/services/severity via keyword matching |

## Data Schema

### Common Incident Format

```typescript
interface Incident {
  id: string;                    // provider-prefixed: "aws-123", "azure-456", "gcp-789"
  provider: "aws" | "azure" | "gcp";
  title: string;
  description: string;
  severity: "minor" | "major" | "critical";
  status: "resolved" | "ongoing";
  startedAt: string;             // ISO 8601
  resolvedAt: string | null;
  durationMinutes: number | null;
  affectedServices: ServiceImpact[];
  updates: StatusUpdate[];
  sourceUrl: string;             // link to official status page
}

interface ServiceImpact {
  serviceName: string;           // provider's native name (e.g., "Amazon EC2")
  category: ServiceCategory;     // normalized bucket for cross-provider comparison
  regions: string[];
}

type ServiceCategory =
  | "compute" | "storage" | "networking" | "database"
  | "ai-ml" | "security" | "analytics" | "devtools"
  | "messaging" | "management" | "other";

interface StatusUpdate {
  timestamp: string;
  status: string;
  message: string;
}
```

### Severity Mapping

- **GCP**: `high` -> critical, `medium` -> major, `low` -> minor (from JSON `severity` field)
- **AWS**: Derived from `status` field (3 = critical, 2 = major, 1 = minor)
- **Azure**: Inferred from narrative keywords + number of affected services (most heuristic-heavy)

### Service Category Mapping

A manually maintained `data/service-map.json` maps each provider's service names to the normalized `ServiceCategory` values. This powers the category-based grouping on the frontend and cross-provider comparison views.

### Uptime Calculation

For a given time window (e.g., 90 days):

```
uptime% = (total_minutes - sum(incident_duration_minutes)) / total_minutes * 100
```

Per-category scores only count incidents affecting services in that category. Computed at build time and stored in `data/computed/uptime-scores.json`.

This is an estimate based on publicly reported incidents. Actual SLA performance may differ.

## Site Structure

### Pages

1. **`/` — Dashboard (Landing Page)**
   - 90-day uptime score cards per provider (AWS, Azure, GCP)
   - Side-by-side incident heatmap: weeks as columns, one row per provider, colored by severity (green = clean, yellow = minor, red = major/critical)
   - Recent incidents feed with provider badge, title, relative time, and duration
   - Footer disclaimer with link to /about

2. **`/provider/:name` — Provider Detail** (e.g., `/provider/aws`)
   - Monthly uptime trend line chart (12 months)
   - Category breakdown table (compute, storage, networking, etc.) with uptime %
   - Full incident history table, filterable by category, severity, region, date range

3. **`/compare` — Cross-Provider Comparison**
   - Grouped bar chart: service categories on x-axis, 3 bars per category (one per provider)
   - Curated head-to-head matchups for equivalent services:
     - Compute: EC2 vs Azure VMs vs Compute Engine
     - Storage: S3 vs Blob Storage vs Cloud Storage
     - Database: RDS vs Azure SQL Database vs Cloud SQL
     - (more as data supports)

4. **`/incident/:id` — Incident Detail**
   - Provider badge, severity badge
   - Title, date, time range (UTC), duration
   - Affected services as tags
   - Chronological timeline of status updates
   - Link to official source

5. **`/about` — Methodology & Disclaimer**
   - Exact source URLs scraped per provider
   - Severity mapping and normalization approach
   - Uptime calculation formula
   - Known limitations (providers may not report all incidents publicly, Azure data requires heuristic parsing)
   - Collection frequency (daily via GitHub Actions)
   - Link to open-source repo for full audit

### Navigation

Top nav: `Cloud Historic Uptime | Dashboard | AWS | Azure | GCP | Compare`

### Footer (all pages)

> Data sourced from official provider status pages. Not affiliated with AWS, Microsoft, or Google. Uptime scores are calculated estimates based on publicly reported incidents — actual SLA performance may differ. [Learn more](/about)

## Tech Stack

- **Framework**: Astro (static-site-first, ships minimal JS)
- **Interactive charts**: React islands with Recharts
- **Scrapers**: TypeScript, run via Node.js
  - GCP: direct JSON fetch
  - AWS: JSON fetch + HTML fallback (Cheerio)
  - Azure: HTML scraping (Cheerio)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Package manager**: npm

## GitHub Actions

### `collect.yml` — Daily Data Collection

- **Schedule**: `cron: '0 6 * * *'` (daily at 6:00 UTC)
- **Steps**: checkout -> run scrapers -> merge new incidents (deduplicate by ID) -> recompute uptime scores -> commit and push if changes exist
- **Also triggered**: manually via `workflow_dispatch`

### `deploy.yml` — Build & Deploy

- **Trigger**: pushes to `main` that touch `data/` or `src/`
- **Steps**: checkout -> `npm install` -> `astro build` -> deploy to GitHub Pages

## Repo Structure

```
cloud-historic-uptime/
├── .github/workflows/
│   ├── collect.yml          # daily scraper cron
│   └── deploy.yml           # build + deploy on change
├── scrapers/
│   ├── aws.ts               # AWS scraper
│   ├── azure.ts             # Azure scraper
│   ├── gcp.ts               # GCP scraper
│   ├── normalize.ts         # common schema, helpers, severity mapping
│   └── run.ts               # CLI entrypoint for running scrapers
├── data/
│   ├── incidents/            # aws.json, azure.json, gcp.json
│   ├── computed/             # uptime-scores.json
│   └── service-map.json     # service name -> category mapping
├── src/                      # Astro site
│   ├── pages/
│   │   ├── index.astro       # dashboard
│   │   ├── provider/
│   │   │   └── [name].astro  # provider detail
│   │   ├── compare.astro     # cross-provider comparison
│   │   ├── incident/
│   │   │   └── [id].astro    # incident detail
│   │   └── about.astro       # methodology + disclaimer
│   ├── components/           # React chart islands
│   │   ├── Heatmap.tsx
│   │   ├── UptimeTrend.tsx
│   │   ├── CategoryBar.tsx
│   │   └── IncidentTimeline.tsx
│   └── layouts/
│       └── Base.astro        # shared layout with nav + footer disclaimer
├── README.md
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## README.md

The repo README serves as the entry point for people discovering the project on GitHub:

- **What this is** — one-liner description + screenshot/preview of the live site
- **Live site link** — prominent at the top
- **What's tracked** — AWS, Azure, GCP with a note on service categories
- **Methodology** — brief version of data collection and uptime calculation, linking to `/about` for details
- **Data sources** — the 3 official status page URLs
- **Disclaimer** — not affiliated with any provider, estimates based on public data
- **Contributing** — how to add a provider or fix a scraper
- **Running locally** — `npm install && npm run dev`
