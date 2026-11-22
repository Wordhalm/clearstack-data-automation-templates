# ClearStack Data — n8n Workflows & Claude MCP Templates for Apify

Production-ready **n8n automation templates** and **Claude / Cursor MCP configurations** for B2B intelligence, ad monitoring, direct career-site job search, and European regulatory data.

Every workflow calls lightweight, **HTTP-only Apify Actors** (256–512 MB RAM, zero headless browsers, zero paid proxies) with incremental monitoring (`onlyNewSinceLastRun: true`) so scheduled runs only return and bill for new items.

- **Apify Store Profile:** https://apify.com/clearstack-data
- **MCP Endpoint:** `https://mcp.apify.com`
- **Pricing Model:** Transparent Pay-Per-Event (no extra Apify compute/proxy surcharges)

---

## Quick Decision Table: Which Template & Actor Should You Use?

| Problem you want to solve | n8n Template (import JSON) | Apify Actor | Measured Speed (Apify Cloud) | Pricing (Pay-Per-Event) |
| :--- | :--- | :--- | :--- | :--- |
| **Monitor competitor Google Ads daily** (Text, Image, Video, EU DSA) | [`daily-competitor-google-ads-slack-alert.json`](./daily-competitor-google-ads-slack-alert.json) | [`clearstack-data/google-ads-transparency-scraper`](https://apify.com/clearstack-data/google-ads-transparency-scraper) | 49 ads in 11.7 s (58 MB RAM) | $0.002/run + $1.20 / 1,000 ads |
| **Track public Telegram channels without login or phone number** | [`telegram-channels-ai-digest-slack.json`](./telegram-channels-ai-digest-slack.json) | [`clearstack-data/telegram-public-channel-monitor`](https://apify.com/clearstack-data/telegram-public-channel-monitor) | 30 posts in 3.1 s (74 MB RAM) | $0.002/run + $1.50 / 1,000 posts |
| **Search live direct-apply jobs across 25,787 Greenhouse, Lever, Ashby & SmartRecruiters boards** | [`daily-ats-hiring-signals-slack.json`](./daily-ats-hiring-signals-slack.json) | [`clearstack-data/career-site-jobs-search`](https://apify.com/clearstack-data/career-site-jobs-search) | 2,714 jobs scanned in 2.4 s (140 MB RAM) | $0.002/run + $1.50 / 1,000 jobs |
| **Validate EU-27 VAT (VIES) & enrich FR SIRENE/RNE, CH Zefix, NO Brreg, FI PRH, GLEIF LEI** | [`eu-vat-kyb-sheets-enricher.json`](./eu-vat-kyb-sheets-enricher.json) | [`clearstack-data/eu-company-kyb-enricher`](https://apify.com/clearstack-data/eu-company-kyb-enricher) | 10 companies in 12.4 s (57 MB RAM) | $4.00 / 1,000 companies (no start fee) |
| **Monitor EU TED, France BOAMP & UK Find a Tender public procurement notices** | [`daily-eu-public-tenders-slack-alert.json`](./daily-eu-public-tenders-slack-alert.json) | [`clearstack-data/eu-public-tenders-monitor`](https://apify.com/clearstack-data/eu-public-tenders-monitor) | 15 notices across 3 portals in 2.8 s (58 MB RAM) | $2.00 / 1,000 notices (no start fee) |
| **Bulk audit websites for AI-readiness (`llms.txt`, GPTBot/ClaudeBot, SEO, tech stack)** | Use HTTP POST below | [`clearstack-data/ai-readiness-geo-auditor`](https://apify.com/clearstack-data/ai-readiness-geo-auditor) | 10 domains in 4.1 s (247 MB RAM) | $4.00 / 1,000 domains (no start fee) |

---

## Ready-to-Run Apify Store Example Pages

Try any use case directly in your browser without writing code:

- [Google Ads Competitor Monitor (New Ads Alert)](https://apify.com/clearstack-data/google-ads-transparency-scraper/examples/google-ads-competitor-monitor-new-ads-alert)
- [Telegram Public Channel New Posts Monitor](https://apify.com/clearstack-data/telegram-public-channel-monitor/examples/telegram-public-channel-new-posts-monitor)
- [EU VAT Number Bulk Validator (VIES API)](https://apify.com/clearstack-data/eu-company-kyb-enricher/examples/eu-vat-number-bulk-validator-vies-api)
- [French SIREN & SIRET Company Enricher (INSEE SIRENE, RNE, VAT)](https://apify.com/clearstack-data/eu-company-kyb-enricher/examples/french-siren-siret-company-enricher-insee-sirene-rne-vat)
- [Swiss Zefix Commercial Register & UID Lookup](https://apify.com/clearstack-data/eu-company-kyb-enricher/examples/swiss-zefix-commercial-register-uid-lookup)
- [France BOAMP Daily Public Tenders Monitor](https://apify.com/clearstack-data/eu-public-tenders-monitor/examples/france-boamp-daily-public-tenders-monitor)

---

## 1. Setup in n8n (2 Minutes)

1. Download any `.json` file from this repository.
2. In n8n, open a new workflow and select **Import from File**.
3. Create an **HTTP Header Auth** credential:
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer YOUR_APIFY_API_TOKEN`
4. Attach that credential to the **HTTP Request** node, customize your input parameters (domains, channels, companies, or keywords), and activate the schedule.

---

## 2. Setup with Claude Desktop, Claude Code, or Cursor (Apify MCP)

Add the official Apify MCP server to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "apify": {
      "url": "https://mcp.apify.com",
      "headers": {
        "Authorization": "Bearer YOUR_APIFY_API_TOKEN"
      }
    }
  }
}
```

### Example Prompts for AI Agents

- **Google Ads Competitor Intelligence:**
  > *"Call `clearstack-data/google-ads-transparency-scraper` for `stripe.com` and `shopify.com` in region `US` over the last 30 days, and summarize their active creative angles."*
- **Telegram OSINT / News Digest (No Login Required):**
  > *"Call `clearstack-data/telegram-public-channel-monitor` with `channels: ["durov", "bloomberg"]` and `onlyNewSinceLastRun: true`, then summarize today's announcements."*
- **Direct Career Site Job Search (`apify claude job search`):**
  > *"Call `clearstack-data/career-site-jobs-search` with `keywords: ["AI Engineer"]` and `remoteOnly: true` across top tech and AI career boards, and return direct-apply URLs."*
- **EU B2B KYB & VAT Verification:**
  > *"Call `clearstack-data/eu-company-kyb-enricher` for `IE3206488LH`, `FR22424761419`, and `CHE-105.909.036` and verify VAT validity, legal status, and LEI codes."*

---

## 3. Direct REST API Call (`curl` / Python / Node.js)

Every ClearStack Data Actor supports synchronous single-request execution via Apify's `run-sync-get-dataset-items` endpoint:

```bash
curl -X POST "https://api.apify.com/v2/acts/clearstack-data~google-ads-transparency-scraper/run-sync-get-dataset-items" \
  -H "Authorization: Bearer YOUR_APIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": ["stripe.com", "shopify.com"],
    "region": "US",
    "format": "ALL",
    "dateRangeDays": 30,
    "maxAdsPerTarget": 20,
    "onlyNewSinceLastRun": true,
    "monitorStateName": "competitors-us"
  }'
```

---

## Frequently Asked Questions

### How do I monitor competitor Google Ads in n8n without paying for duplicates every day?
Use `daily-competitor-google-ads-slack-alert.json` with `onlyNewSinceLastRun: true` and a fixed `monitorStateName`. The Actor persists previously seen `creativeId`s in an Apify Key-Value Store and returns (and bills per item) only brand-new ads launched since the previous run.

### Can I scrape public Telegram channels without a Telegram phone number, API ID, or session?
Yes. `clearstack-data/telegram-public-channel-monitor` parses Telegram's public web preview (`t.me/s/<channel>`) over pure HTTP with backwards pagination (`?before=<messageId>`), extracting views, reactions, media URLs, links, and subscriber counts with zero account-ban risk.

### Why search Greenhouse, Lever, Ashby, and SmartRecruiters directly instead of scraping LinkedIn or Indeed?
LinkedIn and Indeed aggressively block scrapers and often list expired reposts. `clearstack-data/career-site-jobs-search` bundles a verified index of 25,787 employers and queries their official public ATS JSON APIs directly, returning live openings with direct-apply links in ~2–4 seconds.

To check a single company first, the free [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/) tells you which ATS it uses and lists its open roles in the browser.

### Does EU Company KYB Enricher require government API keys?
No. EU VIES (all 27 EU member states), France DINUM (INSEE SIRENE + RNE), Switzerland Zefix, Norway Brreg, Finland PRH/YTJ, and GLEIF LEI all work out of the box with zero API keys. A UK Companies House API key is strictly optional.

---

## License

The workflow templates and documentation in this repository are licensed under the [MIT License](./LICENSE).
