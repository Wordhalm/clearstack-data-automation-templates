# ClearStack Data — n8n Workflows & Claude MCP Templates for Apify

Production-ready **n8n automation templates**, **Clay recipes**, and **Claude / Cursor MCP configurations** for European KYB & sanctions compliance, multi-signal B2B buying intent, ad intelligence, direct career-site job search, and European public procurement.

Every workflow calls lightweight, **HTTP-only Apify Actors** (256–512 MB RAM, zero headless browsers, zero mandatory paid proxies) with incremental monitoring (`onlyNewSinceLastRun: true`) and hard `maxTotalChargeUsd` spending caps.

- **Apify Store Profile:** https://apify.com/clearstack-data
- **Dedicated MCP Server (Claude / Cursor / VS Code):** [`npx -y clearstack-data-mcp`](https://www.npmjs.com/package/clearstack-data-mcp) (`v0.3.0`, 6 tools · [GitHub](https://github.com/Wordhalm/clearstack-data-mcp) · [Official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=clearstack-data-mcp) · [Glama](https://glama.ai/mcp/servers/Wordhalm/clearstack-data-mcp))
- **Pricing Model:** Transparent Pay-Per-Event (no extra Apify compute surcharges)

---

## Flagship Production n8n Workflows (Multi-Branch, Error-Handled, Deduplicated)

Built to production standards with input validation, parallel Sheets + Slack routing, deduplicated `appendOrUpdate` writes, spend caps, and full canvas documentation:

| Workflow | Architecture | Apify Actor(s) | What It Automates |
| :--- | :--- | :--- | :--- |
| [**`eu-vendor-kyb-sanctions-compliance-gate.json`**](./eu-vendor-kyb-sanctions-compliance-gate.json) | 18 nodes · Dual trigger (n8n Form + Weekday Sheet) · 3-way Switch (`BLOCKED` / `MANUAL_REVIEW` / `APPROVED`) · Pending Sheet status sync · Error routing | [`clearstack-data/eu-company-kyb-enricher`](https://apify.com/clearstack-data/eu-company-kyb-enricher) | Validates EU-27 VAT (VIES), enriches FR SIRENE/RNE, CH Zefix, NO Brreg, FI PRH & GLEIF LEI, screens entities & officers against live US OFAC SDN/ALT, EU FSF & UN SC sanctions, scores risk 0–100, logs audit trail, upserts approved vendors, and updates processed rows in `Pending_Vendors`. |
| [**`b2b-account-buying-signals-pipeline.json`**](./b2b-account-buying-signals-pipeline.json) | 17 nodes · Parallel dual-Actor fan-out + Merge · Per-lane error alerts · Alias unification · Intent scoring (0–100) · `HOT` / `WARM` / `QUIET` routing | [`clearstack-data/career-site-jobs-search`](https://apify.com/clearstack-data/career-site-jobs-search) + [`clearstack-data/google-ads-transparency-scraper`](https://apify.com/clearstack-data/google-ads-transparency-scraper) | Monitors target B2B accounts daily across 25,787 ATS boards (Greenhouse, Lever, Ashby, SmartRecruiters) and Google Ads Transparency Center in parallel, merges signals safely on quiet/partial-error days, and routes HOT accounts to `#sales-signals` + Sheets. |

Validate both production workflows locally (JSON structure, n8n expression syntax, sticky-note layout, and sandboxed JS simulation across all branches):

```bash
node scripts/validate-workflows.mjs
```

---

## Lightweight Quickstart n8n Workflows (Single-Actor Templates)

| Problem you want to solve | n8n Template (import JSON) | Apify Actor | Measured Speed (Apify Cloud) | Pricing (Pay-Per-Event) |
| :--- | :--- | :--- | :--- | :--- |
| **Monitor competitor Google Ads daily** (Text, Image, Video, EU DSA impressions/targeting, optional proxy) | [`daily-competitor-google-ads-slack-alert.json`](./daily-competitor-google-ads-slack-alert.json) | [`clearstack-data/google-ads-transparency-scraper`](https://apify.com/clearstack-data/google-ads-transparency-scraper) | 49 ads in 11.7 s (58 MB RAM) | $0.002/run + $1.20 / 1,000 ads |
| **Track public Telegram channels without login** (+ OSINT domains, `$TICKERS`, EVM/BTC/SOL wallets, engagement rate) | [`telegram-channels-ai-digest-slack.json`](./telegram-channels-ai-digest-slack.json) | [`clearstack-data/telegram-public-channel-monitor`](https://apify.com/clearstack-data/telegram-public-channel-monitor) | 30 posts in 3.1 s (74 MB RAM) | $0.002/run + $1.50 / 1,000 posts |
| **Search live direct-apply jobs across 25,787 ATS boards** (salaries, seniority, 65+ tech skills) | [`daily-ats-hiring-signals-slack.json`](./daily-ats-hiring-signals-slack.json) | [`clearstack-data/career-site-jobs-search`](https://apify.com/clearstack-data/career-site-jobs-search) | 2,714 jobs scanned in 2.4 s (140 MB RAM) | $0.002/run + $1.50 / 1,000 jobs |
| **Validate EU-27 VAT (VIES), enrich EU registries & screen OFAC/EU/UN sanctions** | [`eu-vat-kyb-sheets-enricher.json`](./eu-vat-kyb-sheets-enricher.json) | [`clearstack-data/eu-company-kyb-enricher`](https://apify.com/clearstack-data/eu-company-kyb-enricher) | 10 companies in 12.4 s (57 MB RAM) | $4.00 / 1,000 companies (no start fee) |
| **Monitor EU TED, France BOAMP & UK Find a Tender** (open tenders, contract awards, winners, values) | [`daily-eu-public-tenders-slack-alert.json`](./daily-eu-public-tenders-slack-alert.json) | [`clearstack-data/eu-public-tenders-monitor`](https://apify.com/clearstack-data/eu-public-tenders-monitor) | 15 notices across 3 portals in 2.8 s (58 MB RAM) | $2.00 / 1,000 notices (no start fee) |
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

## Clay Recipes

Paste-in JSON for Clay's **Run Apify Actor** enrichment, one column per signal: open roles at an account, Google Ads an account is running, EU VAT and registry check. See [clay-recipes/](clay-recipes/README.md).

## Free Tool

[ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/): look up which ATS any of 25,787 companies uses and see its open roles in the browser.

---

## 1. Setup in n8n (2 Minutes)

1. Download any `.json` file from this repository.
2. In n8n, open a new workflow and select **Import from File**.
3. Create an **HTTP Header Auth** credential:
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer <YOUR_APIFY_TOKEN>`
4. Attach that credential to the **HTTP Request** node(s), connect Google Sheets / Slack where used, and activate the workflow.

---

## 2. Setup with Claude Code, Claude Desktop, Cursor, or VS Code (MCP)

Use the dedicated [`clearstack-data-mcp`](https://github.com/Wordhalm/clearstack-data-mcp) server (`npx -y clearstack-data-mcp`, 6 tools including `search_eu_tenders`) for trimmed token-efficient output, automatic `maxTotalChargeUsd` spending caps, and 45-second timeout handling:

```bash
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

Or add to `.cursor/mcp.json` / `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clearstack-data": {
      "command": "npx",
      "args": ["-y", "clearstack-data-mcp"],
      "env": { "APIFY_TOKEN": "YOUR_APIFY_TOKEN" }
    }
  }
}
```

Alternatively, connect Apify's remote MCP server (`https://mcp.apify.com`) with `Authorization: Bearer <YOUR_APIFY_TOKEN>`.

### Example Prompts for AI Agents

- **EU B2B KYB, VAT & Sanctions Screening:**
  > *"Call `enrich_eu_company` for `FR22424761419` and `CHE-105.909.036` with `screenSanctions: true` and report VAT validity, officers, LEI, and OFAC/EU/UN sanctions status."*
- **Direct Career Site Job Search (Salaries & Tech Stack):**
  > *"Call `search_career_site_jobs` for `Stripe` and `Mistral` with `minSalaryUsd: 180000` and `requiredSkills: ["Kubernetes"]`, returning direct-apply URLs."*
- **Google Ads Competitor Intelligence (EU DSA & Evergreen Ads):**
  > *"Call `scrape_google_ads` for `stripe.com` and `shopify.com` with `minActiveDays: 30` and `includeDetails: true` to find long-running winning ads and EU impression ranges."*
- **European Public Tenders & Contract Awards:**
  > *"Call `search_eu_tenders` with `noticeCategory: "CONTRACT_AWARD"`, `minValueEur: 100000`, and `keywords: ["cloud"]` across EU TED, France BOAMP, and UK Find a Tender."*
- **Telegram OSINT / Finance Monitor (No Login):**
  > *"Call `monitor_telegram_channels` on `["durov", "bloomberg"]` with `minViews: 10000` and `excludeForwarded: true` to extract links, tickers, and engagement rates."*

---

## 3. Direct REST API Call (`curl` / Python / Node.js)

Every ClearStack Data Actor supports synchronous single-request execution via Apify's `run-sync-get-dataset-items` endpoint:

```bash
curl -X POST "https://api.apify.com/v2/acts/clearstack-data~eu-company-kyb-enricher/run-sync-get-dataset-items?maxTotalChargeUsd=0.05" \
  -H "Authorization: Bearer YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["FR22424761419", "CHE-105.909.036"],
    "validateVat": true,
    "enrichGleifLei": true,
    "screenSanctions": true
  }'
```

---

## Frequently Asked Questions

### How do I monitor competitor Google Ads or ATS jobs in n8n without paying for duplicates every day?
Use `b2b-account-buying-signals-pipeline.json` (or the lightweight single-Actor templates) with `onlyNewSinceLastRun: true` and a fixed `monitorStateName`. Each Actor persists seen IDs in an Apify Key-Value Store and returns (and bills per item) only brand-new ads or postings since the previous run.

### Can I scrape public Telegram channels without a Telegram phone number, API ID, or session?
Yes. `clearstack-data/telegram-public-channel-monitor` parses Telegram's public web preview (`t.me/s/<channel>`) over pure HTTP with backwards pagination (`?before=<messageId>`), extracting views, reactions, engagement rates, domains, tickers, and crypto wallets with zero account-ban risk.

### Why search Greenhouse, Lever, Ashby, and SmartRecruiters directly instead of scraping LinkedIn or Indeed?
LinkedIn and Indeed aggressively block scrapers and often list expired reposts. `clearstack-data/career-site-jobs-search` bundles a verified index of 25,787 employers and queries their official public ATS JSON APIs directly, returning live openings with structured salaries, seniority, 65+ tech skills, and direct-apply links in ~2–4 seconds.

### Does EU Company KYB & Sanctions Enricher require government or sanctions API keys?
No. EU VIES (all 27 EU member states), France DINUM (INSEE SIRENE + RNE), Switzerland Zefix, Norway Brreg, Finland PRH/YTJ, GLEIF LEI, and live US OFAC SDN/ALT, EU Consolidated Financial Sanctions, and UN Security Council screening all work out of the box with zero API keys. A UK Companies House API key is strictly optional.

---

## License

The workflow templates and documentation in this repository are licensed under the [MIT License](./LICENSE).
