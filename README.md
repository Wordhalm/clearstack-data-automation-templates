# ClearStack Data — n8n & MCP Automation Templates for Apify

Ready-to-import **n8n workflow JSON templates** and **Claude / Cursor MCP configurations** powered by lightweight, HTTP-only Apify Actors from [ClearStack Data](https://apify.com/clearstack-data).

## Included n8n Templates

| Workflow JSON | Use Case | Apify Actor |
| :--- | :--- | :--- |
| `daily-competitor-google-ads-slack-alert.json` | Daily Slack alert when competitors launch new Google Ads (`onlyNewSinceLastRun: true`) | [Google Ads Transparency Center Scraper](https://apify.com/clearstack-data/google-ads-transparency-scraper) |
| `telegram-channels-ai-digest-slack.json` | Hourly/2h incremental monitor of public Telegram channels (`t.me/s/`, zero login) | [Telegram Public Channel Monitor](https://apify.com/clearstack-data/telegram-public-channel-monitor) |
| `daily-ats-hiring-signals-slack.json` | Weekday B2B target-account hiring-signal alerts across 25,700+ Greenhouse, Lever, Ashby & SmartRecruiters career boards | [Direct Career Site Jobs Search (25K+)](https://apify.com/clearstack-data/career-site-jobs-search) |
| `eu-vat-kyb-sheets-enricher.json` | Bulk EU VIES VAT validation + France SIRENE/RNE, Switzerland Zefix, Norway Brreg, Finland PRH & GLEIF LEI enrichment in Google Sheets | [EU Company KYB & VIES Enricher](https://apify.com/clearstack-data/eu-company-kyb-enricher) |
| `daily-eu-public-tenders-slack-alert.json` | Daily EU TED (27 countries) + France BOAMP + UK Find a Tender public procurement alerts to Slack | [EU TED, France BOAMP & UK Public Tenders Monitor](https://apify.com/clearstack-data/eu-public-tenders-monitor) |

## Quick Setup in n8n (2 minutes)

1. Download any `.json` file above and click **Import from File** in n8n.
2. Create an **HTTP Header Auth** credential in n8n:
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_APIFY_API_TOKEN`
3. Select that credential in the **HTTP Request** node and run or activate the schedule.

## Using with Claude / Cursor via Apify MCP (`mcp.apify.com`)

Connect the official Apify MCP server (`https://mcp.apify.com`) and call any Actor directly from Claude Desktop, Claude Code, or Cursor:

- **Direct Job Search (`apify claude job search`):**
  > *"Use `clearstack-data/career-site-jobs-search` to find remote AI Engineer roles across OpenAI, Anthropic, Stripe, Linear, Vercel, and Notion."*
- **Competitor Ad Intelligence:**
  > *"Use `clearstack-data/google-ads-transparency-scraper` to fetch active ads for `stripe.com` and `shopify.com` in the US over the last 30 days."*
- **EU VAT & KYB Verification:**
  > *"Use `clearstack-data/eu-company-kyb-enricher` to validate `IE3206488LH` and `FR22424761419`."*
