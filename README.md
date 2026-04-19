# Cloud Historic Uptime

Historical uptime comparison for **AWS**, **Microsoft Azure**, and **Google Cloud** — based on publicly reported incidents from official status pages.

**[View the live site →](https://Ghoul-SSZ.github.io/cloud-historic-uptime/)**


## What's Tracked

Incident data is collected from each provider's official status page and normalized into a common format. Services are grouped into categories (Compute, Storage, Networking, Database, AI/ML, Security, Analytics, Dev Tools, Messaging, Management) for cross-provider comparison.

| Provider | Incidents | History | Source |
|----------|-----------|---------|--------|
| AWS | 44 | ~11 months | Health API (UTF-16) + S3 history bucket |
| Azure | 93 | ~5 years | Status history API with `startDate=all` (Post-Incident Reviews) |
| GCP | 851 | ~5 years | 204 product history pages + individual incident HTML |

**Note:** GCP reports significantly more incidents because their status pages capture granular per-product events including minor degradations. AWS and Azure expose fewer historical records. Short time windows (30d, 90d) provide the most balanced cross-provider comparison.

## Features

- **Cross-provider comparison** — bar charts, line charts, and head-to-head cards across Compute, Storage, Database, Networking, and AI/ML
- **Per-provider dashboards** — overall uptime headline, monthly trend, and category breakdown
- **Configurable time windows** — 30d, 90d, 180d, year to date, 1yr, 2yr, 3yr, 5yr
- **Provider toggles** — deselect providers on the compare page for direct 1-on-1 comparison
- **Incident heatmap** — weekly severity grid across all providers
- **Data transparency** — collapsible "About this data" sections explaining sources, methodology, and caveats

## Methodology

Uptime percentages are calculated as:

```
uptime% = (total_minutes - downtime_minutes) / total_minutes × 100
```

Two adjustments are applied to produce meaningful numbers:

- **24-hour cap** — each incident's downtime contribution is capped at 24 hours. Long-running tracked issues (e.g., multi-week known issues) are not continuous full outages.
- **Overlap merging** — concurrent incidents are merged into non-overlapping intervals so simultaneous outages are not double-counted.

Per-category scores only count incidents affecting services in that category.

## Tech Stack

- **Astro** — static site generator with React islands (`client:load`)
- **React + Recharts** — interactive charts (BarChart, LineChart)
- **Cheerio** — HTML parsing for Azure PIR pages and GCP incident pages
- **TypeScript** — end to end

## Project Structure

```
scrapers/
  aws.ts              # Dual-source: live Health API (UTF-16) + S3 history bucket
  azure.ts            # Status history API with pagination
  gcp.ts              # Product history pages + individual incident HTML
  compute-uptime.ts   # Uptime score computation with overlap merging
  service-map.ts      # Service name → category mapping
  run.ts              # Orchestrator: fetch, normalize, compute scores
data/
  incidents/          # Normalized incident JSON per provider
  computed/           # Precomputed uptime scores
src/
  components/         # React components (charts, tables, toggles)
  layouts/            # Astro base layout
  lib/                # Shared constants, data helpers, uptime utils
  pages/              # Astro pages (index, compare, provider/[name])
```

## Running Locally

```bash
npm install
npm run dev          # Start dev server
npm run collect      # Run scrapers to fetch latest data
npm run build        # Build static site
npx vitest run       # Run tests (32 tests across 6 files)
```

## Disclaimer

This project is **not affiliated** with Amazon Web Services, Microsoft, or Google. Uptime scores are **calculated estimates** based on publicly reported incidents. Actual SLA performance as experienced by customers may differ. Providers may not publicly report all incidents.

## License

MIT
