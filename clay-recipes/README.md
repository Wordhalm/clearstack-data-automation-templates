# Clay recipes for ClearStack Data Apify Actors

Three account-level signals for Clay tables, each one a single **Run Apify Actor** enrichment column. You paste the JSON below into the enrichment and insert one column from your table.

| Recipe | Actor | Clay input column | Typical cost per row |
| --- | --- | --- | --- |
| [1. Open roles at the account](#1-open-roles-at-the-account-hiring-signal) | [Career Site Jobs Search](https://apify.com/clearstack-data/career-site-jobs-search) | Company name | $0.002 + $0.0015 per job returned (max $0.04 with the settings below) |
| [2. Google Ads the account is running](#2-google-ads-the-account-is-running) | [Google Ads Transparency Scraper](https://apify.com/clearstack-data/google-ads-transparency-scraper) | Company domain | $0.002 + $0.0012 per ad (max $0.014 with the settings below) |
| [3. EU VAT and registry check](#3-eu-vat-and-company-registry-check-kyb) | [EU Company KYB Enricher](https://apify.com/clearstack-data/eu-company-kyb-enricher) | VAT number, SIREN/SIRET, Swiss UID | $0.004 |

Prices are Apify pay-per-event prices on the free tier and go down on paid Apify plans. Clay credits are separate and depend on your Clay plan.

## Setup (once)

1. In Apify, open the Actor's page and create a Task from it (Clay's Apify guide starts with this step so the Actor shows up in your account). Switch the Task input from Manual to JSON to see the full input format.
2. In your Clay table, click **Add enrichment**, search for **Apify** and pick **Run Apify Actor**.
3. Connect your Apify account with your Apify API token (Apify Console → Settings → API & Integrations).
4. Choose the Actor named in the recipe.
5. Paste the recipe's JSON into **Input Data**.
6. Replace the `{{…}}` placeholder with the column token from your table. Clay's rule: the key stays in quotes, the token itself gets no quotes.
7. Run it on 5 rows first. Then decide whether to keep **Auto-update** on: with it on, every new row triggers a paid run.

If Clay reports `Cannot parse input JSON body`, paste the JSON without the token first, check that it runs, then add the token.

---

## 1. Open roles at the account (hiring signal)

Which of your target accounts is hiring for the roles you sell into, read from their own Greenhouse, Lever, Ashby or SmartRecruiters board.

**Actor:** `clearstack-data/career-site-jobs-search`

```json
{
  "companies": [{{Company Name}}],
  "keywords": ["Data Engineer", "Analytics", "RevOps"],
  "location": "",
  "remoteOnly": false,
  "maxJobsTotal": 25
}
```

- `companies` accepts a company name ("Stripe"), an `ats:slug` pair (`greenhouse:stripe`) or a job board URL (`https://jobs.lever.co/palantir`). Plain website domains are not matched; use the company name column.
- `keywords` is OR logic against job title and department. Replace them with the teams your product sells to. Leave the array empty to get every open role.
- Each returned item has `title`, `department`, `team`, `location`, `isRemote`, `publishedAt` and `applyUrl`. A Clay formula column such as "number of results > 0" gives you a boolean hiring flag.
- Not sure a company is in the 25,787-board index? Check it for free at [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/).

## 2. Google Ads the account is running

Whether the account advertises on Google, in which formats, and since when. Useful for agencies and for any tool sold to paid-acquisition teams.

**Actor:** `clearstack-data/google-ads-transparency-scraper`

```json
{
  "targets": [{{Company Domain}}],
  "region": "ALL",
  "format": "ALL",
  "dateRangeDays": 30,
  "maxAdsPerTarget": 10
}
```

- `targets` takes a domain (`stripe.com`), a Google advertiser ID or a Google Ads Transparency Center URL.
- `region` takes an ISO-2 country code (`US`, `GB`, `FR`, `DE`, …) to keep only ads shown in that country.
- Each returned ad has `advertiserName`, `format`, `firstShownDate`, `lastShownDate`, `adUrl` and `previewImageUrl`. Zero results over 30 days usually means the account is not buying Google Ads under that domain.

## 3. EU VAT and company registry check (KYB)

Validate a VAT number against the European Commission's VIES service and pull the official registry record (France SIRENE, Swiss Zefix, Norway Brønnøysund, Finland PRH, GLEIF LEI).

**Actor:** `clearstack-data/eu-company-kyb-enricher`

```json
{
  "queries": [{{VAT Number}}],
  "defaultCountry": "",
  "validateVat": true,
  "enrichGleifLei": true
}
```

- `queries` accepts EU VAT numbers (`FR22424761419`), French SIREN or SIRET, Swiss UID (`CHE-105.909.036`) and Norwegian organisation numbers (`NO:923609016`).
- Fields worth mapping to columns: `kybStatus`, `vatValid`, `legalName`, `status`, `legalForm`, `incorporationDate`, `address`, `leiCode`, `registryUrls`.
- `vatValid` is `null` when VIES gave no verdict (a member state's service is busy or down). Treat it as "check again later", not as invalid; filter on `vatValid = false` for real failures.
- No government API keys needed. UK Companies House data needs your own free key in `companiesHouseApiKey`.

---

Built by [ClearStack Data](https://apify.com/clearstack-data). n8n versions of these workflows are in the [repository root](../README.md).
