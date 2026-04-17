# Cloud Historic Uptime

Historical uptime comparison for **AWS**, **Microsoft Azure**, and **Google Cloud** — based on publicly reported incidents from official status pages.

**[View the live site →](https://YOUR_USERNAME.github.io/cloud-historic-uptime/)**

## What's Tracked

Incident data is collected daily from each provider's official status page and normalized into a common format. Services are grouped into categories (Compute, Storage, Networking, Database, AI/ML, Security, Analytics, DevTools, Messaging, Management) for cross-provider comparison.

## Data Sources

| Provider | Source | Format |
|----------|--------|--------|
| Google Cloud | [status.cloud.google.com/incidents.json](https://status.cloud.google.com/incidents.json) | Structured JSON |
| AWS | [health.aws.amazon.com](https://health.aws.amazon.com/health/status) | JSON events API |
| Azure | [azure.status.microsoft](https://azure.status.microsoft/en-us/status/history/) | HTML (Post Incident Reviews) |

## Methodology

Uptime percentages are calculated as:

```
uptime% = (total_minutes - incident_minutes) / total_minutes × 100
```

Per-category scores only count incidents affecting services in that category. See the [About page](https://YOUR_USERNAME.github.io/cloud-historic-uptime/about) for full methodology details.

## Disclaimer

This project is **not affiliated** with Amazon Web Services, Microsoft, or Google. Uptime scores are **calculated estimates** based on publicly reported incidents. Actual SLA performance as experienced by customers may differ. Providers may not publicly report all incidents.

## Running Locally

```bash
npm install
npm run dev          # Start dev server
npm run collect      # Run scrapers to fetch latest data
npm run build        # Build static site
```

## Contributing

Contributions welcome! Common tasks:

- **Fix a scraper**: If a provider changes their status page format, update the relevant file in `scrapers/`.
- **Add service mappings**: Edit `data/service-map.json` to categorize newly launched services.
- **Add a provider**: Create a new scraper in `scrapers/`, add to `scrapers/run.ts`, and update the frontend.

## License

MIT
