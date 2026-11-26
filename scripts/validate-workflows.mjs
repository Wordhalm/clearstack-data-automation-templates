import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const FLAGSHIP = new Set([
    'eu-vendor-kyb-sanctions-compliance-gate.json',
    'b2b-account-buying-signals-pipeline.json',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Modern n8n Code node v2 execution sandbox: provides ONLY $input and $ (NO legacy `items` global!)
function runCodeV2(code, inputItems, nodeLookup = {}) {
    const $input = {
        all: () => inputItems,
        first: () => inputItems[0] ?? null,
        last: () => inputItems[inputItems.length - 1] ?? null,
    };
    const $ = (name) => ({
        all: () => nodeLookup[name] ?? [],
        first: () => (nodeLookup[name] ?? [])[0] ?? null,
    });
    const fn = new Function('$input', '$', code);
    const out = fn($input, $);
    assert.ok(Array.isArray(out), 'Code v2 node must return an Array');
    for (const row of out) {
        assert.ok(row && typeof row === 'object' && 'json' in row, 'Every returned item must be wrapped in { json: ... }');
    }
    return out;
}

function checkExpressionSyntax(str, ctx) {
    if (typeof str !== 'string') return;
    if (!str.startsWith('={{') || !str.endsWith('}}')) return;
    const expr = str.slice(3, -2).trim();
    try {
        new vm.Script(`(${expr})`);
    } catch (err) {
        throw new Error(`Invalid n8n expression in ${ctx}: ${expr} -> ${err.message}`);
    }
}

function walkExpressions(obj, ctx) {
    if (typeof obj === 'string') {
        checkExpressionSyntax(obj, ctx);
    } else if (Array.isArray(obj)) {
        obj.forEach((v, i) => walkExpressions(v, `${ctx}[${i}]`));
    } else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) walkExpressions(v, `${ctx}.${k}`);
    }
}

const allWorkflowFiles = readdirSync(ROOT).filter((f) => f.endsWith('.json')).sort();
assert.ok(allWorkflowFiles.length >= 7, `Expected >= 7 workflow JSONs, found ${allWorkflowFiles.length}`);

for (const file of allWorkflowFiles) {
    const raw = readFileSync(join(ROOT, file), 'utf8');
    const wf = JSON.parse(raw);
    const isFlagship = FLAGSHIP.has(file);

    // 1. Top-level n8n export hygiene
    assert.ok(wf.name && wf.name.length >= 20, `${file}: descriptive workflow name required`);
    assert.equal(wf.settings?.executionOrder, 'v1', `${file}: executionOrder must be v1`);
    assert.equal(wf.active, false, `${file}: template must have active: false`);
    assert.deepEqual(wf.pinData, {}, `${file}: template must not ship pinned personal data`);
    assert.equal(wf.meta?.templateCredsSetupCompleted, false, `${file}: meta.templateCredsSetupCompleted must be false`);

    // No leaked tokens, real credential IDs, or personal info
    assert.ok(!/apify_api_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|xoxb-[A-Za-z0-9-]+|@gmail\.com|@outlook\./.test(raw), `${file}: leaked secret/personal data`);

    const ids = new Set();
    const names = new Set();
    const functionalNodes = [];
    const stickyNotes = [];

    for (const node of wf.nodes) {
        assert.ok(node.id && UUID_RE.test(node.id) && !ids.has(node.id), `${file}: node "${node.name}" must have unique UUIDv4 id (got "${node.id}")`);
        assert.ok(node.name && !names.has(node.name), `${file}: duplicate/missing node name ${node.name}`);
        assert.ok(!node.credentials, `${file}: template node "${node.name}" must not hardcode personal credential IDs`);
        ids.add(node.id);
        names.add(node.name);

        // No generic default node names
        assert.ok(!/^(HTTP Request|Code|If|Switch|Slack|Google Sheets|Merge)\d*$/i.test(node.name), `${file}: generic node name ${node.name}`);

        walkExpressions(node.parameters, `${file}:${node.name}`);

        // 2. Strict n8n core node parameter schema validation (verified against n8n-io/n8n master)
        if (node.type === 'n8n-nodes-base.code' && node.typeVersion >= 2) {
            assert.equal(node.parameters.mode, 'runOnceForAllItems', `${file}:${node.name}: Code v2 must specify mode`);
            assert.equal(node.parameters.language, 'javaScript', `${file}:${node.name}: Code v2 must specify language: javaScript`);
            assert.ok(!/\bitems\b/.test(node.parameters.jsCode || ''), `${file}:${node.name}: Code v2 must use $input.all(), never legacy 'items'`);
            assert.ok(/\$input\.all\(\)/.test(node.parameters.jsCode || ''), `${file}:${node.name}: Code v2 must read $input.all()`);
        }

        if (node.type === 'n8n-nodes-base.slack' && node.typeVersion >= 2) {
            assert.equal(node.parameters.channel, undefined, `${file}:${node.name}: Slack v2.2 must not use legacy 'channel'`);
            assert.equal(node.parameters.select, 'channel', `${file}:${node.name}: Slack v2.2 must set select: 'channel'`);
            assert.equal(node.parameters.channelId?.__rl, true, `${file}:${node.name}: Slack v2.2 channelId must be a resource locator (__rl: true)`);
            assert.ok(node.parameters.channelId?.value, `${file}:${node.name}: Slack v2.2 channelId.value required`);
        }

        if (node.type === 'n8n-nodes-base.googleSheets' && node.typeVersion >= 4) {
            assert.equal(node.parameters.documentId?.__rl, true, `${file}:${node.name}: Google Sheets documentId must be __rl: true`);
            assert.equal(node.parameters.documentId?.mode, 'list', `${file}:${node.name}: Google Sheets documentId should use mode: 'list' (no fake spreadsheet ID)`);
            assert.equal(node.parameters.documentId?.value, '', `${file}:${node.name}: Google Sheets documentId.value must be empty for list picker`);
            assert.equal(node.parameters.sheetName?.__rl, true, `${file}:${node.name}: Google Sheets sheetName must be __rl: true`);
            assert.equal(node.parameters.sheetName?.mode, 'name', `${file}:${node.name}: Google Sheets sheetName must use mode: 'name'`);
            const op = node.parameters.operation || 'read';
            if (op === 'append' || op === 'appendOrUpdate' || op === 'update') {
                assert.ok(node.parameters.columns && typeof node.parameters.columns === 'object', `${file}:${node.name}: missing columns object`);
                assert.ok(Array.isArray(node.parameters.columns.schema), `${file}:${node.name}: columns.schema must be an array`);
                assert.ok(Array.isArray(node.parameters.columns.matchingColumns), `${file}:${node.name}: columns.matchingColumns must be an array`);
                if (op === 'appendOrUpdate' || op === 'update') {
                    assert.ok(node.parameters.columns.matchingColumns.length >= 1, `${file}:${node.name}: ${op} requires non-empty matchingColumns`);
                }
            }
        }

        if (node.type === 'n8n-nodes-base.httpRequest' && node.typeVersion >= 4) {
            if (node.parameters.sendBody) {
                assert.equal(node.parameters.contentType, 'json', `${file}:${node.name}: HTTP Request v4.2 should explicitly set contentType: 'json'`);
                assert.equal(node.parameters.specifyBody, 'json', `${file}:${node.name}: HTTP Request v4.2 should set specifyBody: 'json'`);
            }
            assert.ok(/maxTotalChargeUsd=/.test(node.parameters.url || ''), `${file}:${node.name}: Apify endpoint must include maxTotalChargeUsd spending cap`);
        }

        if (node.type === 'n8n-nodes-base.if' && node.typeVersion >= 2.2) {
            assert.equal(node.parameters.conditions?.options?.version, 2, `${file}:${node.name}: IF v2.2 requires conditions.options.version = 2`);
        }

        if (node.type === 'n8n-nodes-base.switch' && node.typeVersion >= 3.2) {
            for (const rule of node.parameters.rules?.values || []) {
                assert.equal(rule.conditions?.options?.version, 2, `${file}:${node.name}: Switch v3.2 requires conditions.options.version = 2`);
            }
            assert.ok(node.parameters.options?.fallbackOutput !== undefined, `${file}:${node.name}: Switch v3.2 should specify fallbackOutput`);
        }

        if (node.type === 'n8n-nodes-base.merge' && node.typeVersion >= 3) {
            assert.ok(node.parameters.numberInputs >= 2, `${file}:${node.name}: Merge v3 should specify numberInputs >= 2`);
        }

        if (node.type === 'n8n-nodes-base.formTrigger') {
            assert.ok(node.webhookId && UUID_RE.test(node.webhookId), `${file}:${node.name}: Form Trigger requires valid UUID webhookId`);
        }

        if (node.type === 'n8n-nodes-base.stickyNote') stickyNotes.push(node);
        else functionalNodes.push(node);
    }

    // 3. Connection integrity & overlap checks
    const incoming = new Set();
    for (const [src, conn] of Object.entries(wf.connections)) {
        assert.ok(names.has(src), `${file}: connection source "${src}" does not exist`);
        for (const branch of conn.main || []) {
            for (const edge of branch || []) {
                assert.ok(names.has(edge.node), `${file}: connection target "${edge.node}" does not exist`);
                incoming.add(edge.node);
            }
        }
    }

    for (const node of functionalNodes) {
        const isTrigger = node.type.toLowerCase().includes('trigger');
        if (!isTrigger) {
            assert.ok(incoming.has(node.name), `${file}: orphaned node "${node.name}" has no incoming connection`);
        }
        if (node.onError === 'continueErrorOutput') {
            const outBranches = wf.connections[node.name]?.main || [];
            assert.ok(outBranches.length >= 2 && outBranches[1].length >= 1, `${file}: error output not wired on "${node.name}"`);
        }
    }

    for (let i = 0; i < functionalNodes.length; i++) {
        for (let j = i + 1; j < functionalNodes.length; j++) {
            const [x1, y1] = functionalNodes[i].position;
            const [x2, y2] = functionalNodes[j].position;
            const dist = Math.hypot(x1 - x2, y1 - y2);
            assert.ok(dist >= 120, `${file}: nodes "${functionalNodes[i].name}" and "${functionalNodes[j].name}" too close (dist=${Math.round(dist)})`);
        }
    }

    // 4. Extra n8n Creators publishing bar for flagship templates
    if (isFlagship) {
        assert.ok(functionalNodes.length >= 16, `${file}: flagship expected >= 16 functional nodes, got ${functionalNodes.length}`);
        assert.ok(stickyNotes.length >= 4, `${file}: flagship expected >= 4 sticky notes, got ${stickyNotes.length}`);

        const overview = stickyNotes.find((n) => /### How it works/.test(n.parameters.content));
        assert.ok(overview, `${file}: missing overview sticky note with "### How it works"`);
        assert.equal(overview.parameters.color, 1, `${file}: overview sticky note must be color 1 (yellow), not ${overview.parameters.color}`);
        assert.ok(/### Setup/.test(overview.parameters.content), `${file}: overview sticky note missing "### Setup"`);
        assert.ok(/### Customization/.test(overview.parameters.content), `${file}: overview sticky note missing "### Customization"`);
        assert.ok(/### Limitations/.test(overview.parameters.content), `${file}: overview sticky note missing "### Limitations"`);
        const overviewWords = overview.parameters.content.trim().split(/\s+/).length;
        assert.ok(overviewWords >= 100 && overviewWords <= 300, `${file}: overview sticky note must be 100-300 words (got ${overviewWords})`);

        const stageNotes = stickyNotes.filter((n) => n !== overview);
        // Reserve real n8n label footprint: 90px left, 210px right (from node.x), 160px top (sticky heading), 200px bottom (icon + 2-3 line label)
        const inBox = ([x, y], note) => {
            const [nx, ny] = note.position;
            const w = note.parameters.width || 300;
            const h = note.parameters.height || 300;
            return x >= nx + 90 && x + 210 <= nx + w && y >= ny + 160 && y + 200 <= ny + h;
        };
        for (const node of functionalNodes) {
            assert.ok(!inBox(node.position, overview), `${file}: node "${node.name}" overlaps overview sticky note`);
            assert.ok(stageNotes.some((s) => inBox(node.position, s)), `${file}: node "${node.name}" at [${node.position}] label could overflow stage sticky note`);
        }

        // Verify no horizontal edge cuts directly through an intermediate node on the same row
        const posByName = new Map(functionalNodes.map((n) => [n.name, n.position]));
        for (const [src, conn] of Object.entries(wf.connections)) {
            const p1 = posByName.get(src);
            if (!p1) continue;
            for (const branch of conn.main || []) {
                for (const edge of branch || []) {
                    const p2 = posByName.get(edge.node);
                    if (!p2 || Math.abs(p1[1] - p2[1]) > 40) continue;
                    const minX = Math.min(p1[0], p2[0]);
                    const maxX = Math.max(p1[0], p2[0]);
                    for (const [otherName, po] of posByName.entries()) {
                        if (otherName === src || otherName === edge.node) continue;
                        if (po[0] > minX + 20 && po[0] < maxX - 20 && Math.abs(po[1] - p1[1]) < 60) {
                            assert.fail(`${file}: wire "${src}" -> "${edge.node}" passes directly through "${otherName}"`);
                        }
                    }
                }
            }
        }
    } else {
        assert.ok(stickyNotes.length >= 1 && stickyNotes[0].parameters.color === 1, `${file}: quickstart sticky note must be color 1 (yellow)`);
    }

    console.log(`SCHEMA + LAYOUT OK: ${file} (${functionalNodes.length} functional nodes, ${stickyNotes.length} sticky notes)`);
}

// 5. Runtime simulation of Workflow #1 (EU Vendor KYB, VAT & Sanctions Compliance Gate)
{
    const wf1 = JSON.parse(readFileSync(join(ROOT, 'eu-vendor-kyb-sanctions-compliance-gate.json'), 'utf8'));
    const validateCode = wf1.nodes.find((n) => n.name === 'Normalize & Validate Input').parameters.jsCode;
    const decisionCode = wf1.nodes.find((n) => n.name === 'Score Compliance & Risk').parameters.jsCode;

    const validated = runCodeV2(validateCode, [
        { json: { 'Vendor Identifier or Legal Name': ' FR22424761419 ', 'Country (ISO-2, optional)': 'fr', 'Estimated Annual Spend (EUR)': '15000', 'Requester Email': 'ops@example.com' } },
        { json: { 'Vendor Identifier or Legal Name': 'x', 'Requester Email': 'bad@example.com' } },
        { json: { query: 'Sberbank of Russia', annualSpendEur: '€12,000', requesterEmail: 'buyer@example.com', row_number: 4, complianceStatus: 'PENDING' } },
        { json: { query: 'Mistral AI', defaultCountry: 'FR', annualSpendEur: '€80,000', requesterEmail: 'cfo@example.com', row_number: 5, complianceStatus: 'PENDING' } },
        { json: { query: 'CHE-105.909.036', annualSpendEur: '75.000,50', requesterEmail: 'eu@example.com' } },
        { json: { query: 'NO:923609016', annualSpendEur: '12 500', requesterEmail: 'no@example.com' } },
    ]);

    assert.equal(validated[0].json.isValid, true);
    assert.equal(validated[0].json.fromSheet, false);
    assert.equal(validated[0].json.row_number, null);
    assert.equal(validated[1].json.isValid, false);
    assert.equal(validated[2].json.fromSheet, true);
    assert.equal(validated[2].json.row_number, 4);
    assert.equal(validated[2].json.annualSpendEur, 12000);
    assert.equal(validated[3].json.annualSpendEur, 80000); // Formatted "€80,000" parsed accurately!
    assert.equal(validated[4].json.annualSpendEur, 75000.5); // EU format "75.000,50" parsed accurately!
    assert.equal(validated[5].json.annualSpendEur, 12500); // Space thousands "12 500" parsed accurately!

    const decisions = runCodeV2(
        decisionCode,
        [
            {
                json: {
                    query: 'FR22424761419', found: true, kybStatus: 'VERIFIED_ACTIVE', kybRiskFlags: [],
                    country: 'FR', legalName: 'OVH (OVHCLOUD)', registrationNumber: '424761419', vatNumber: 'FR22424761419',
                    vatValid: true, leiCode: '9695007586GCAKPYJ703', status: 'ACTIVE', address: { full: '2 RUE KELLERMANN 59100 ROUBAIX' },
                    officers: [{ name: 'OCTAVE KLABA', role: 'Président de SAS' }],
                    sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] },
                    registryUrls: ['https://annuaire-entreprises.data.gouv.fr/entreprise/424761419'],
                },
            },
            {
                json: {
                    query: 'Sberbank of Russia', found: false, kybStatus: 'NOT_FOUND', kybRiskFlags: ['SANCTIONS_EXACT_MATCH'],
                    country: null, legalName: null, status: 'UNKNOWN',
                    sanctions: { status: 'EXACT_MATCH', totalMatches: 3, matches: [{ source: 'OFAC_SDN', matchedName: 'SBERBANK OF RUSSIA', matchType: 'EXACT', score: 1, programs: ['RUSSIA-EO14024'] }] },
                },
            },
            {
                json: {
                    query: 'Mistral AI', found: true, kybStatus: 'VERIFIED_ACTIVE', kybRiskFlags: ['VAT_UNVERIFIED'],
                    country: 'FR', legalName: 'MISTRAL AI', registrationNumber: '952418325', vatValid: null, status: 'ACTIVE',
                    sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] },
                },
            },
            {
                json: {
                    query: 'CHE-105.909.036', found: true, kybStatus: 'VERIFIED_INACTIVE', kybRiskFlags: ['COMPANY_INACTIVE'],
                    country: 'CH', legalName: 'Dormant AG', registrationNumber: 'CHE-105.909.036', status: 'INACTIVE',
                    sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] },
                },
            },
            {
                json: {
                    query: 'NO:923609016', found: true, kybStatus: 'VERIFIED_ACTIVE', kybRiskFlags: [],
                    country: 'NO', legalName: 'EQUINOR ASA', registrationNumber: '923609016', vatValid: null, status: 'ACTIVE',
                    sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] },
                },
            },
        ],
        { 'Normalize & Validate Input': validated },
    );

    assert.equal(decisions[0].json.complianceDecision, 'APPROVED');
    assert.equal(decisions[0].json.fromSheet, false);
    assert.equal(decisions[1].json.complianceDecision, 'BLOCKED');
    assert.equal(decisions[1].json.fromSheet, true);
    assert.equal(decisions[1].json.row_number, 4);
    assert.equal(decisions[2].json.complianceDecision, 'MANUAL_REVIEW');
    assert.equal(decisions[2].json.annualSpendEur, 80000);
    assert.equal(decisions[2].json.fromSheet, true);
    assert.equal(decisions[2].json.row_number, 5);
    assert.equal(decisions[3].json.complianceDecision, 'BLOCKED');
    assert.equal(decisions[4].json.complianceDecision, 'APPROVED');
    assert.equal(decisions[4].json.vatValid, 'N/A');

    console.log('RUNTIME V2 OK: Workflow #1 (formatted currencies, Sheet row_number sync vs Form, EU+NO APPROVED, OFAC BLOCKED, VIES outage MANUAL_REVIEW)');
}

// 6. Runtime simulation of Workflow #2 (Multi-Signal B2B Buying Intent Radar)
{
    const wf2 = JSON.parse(readFileSync(join(ROOT, 'b2b-account-buying-signals-pipeline.json'), 'utf8'));
    const buildCode = wf2.nodes.find((n) => n.name === 'Filter & Build Batch Payloads').parameters.jsCode;
    const tagJobsCode = wf2.nodes.find((n) => n.name === 'Tag Hiring Signal Items').parameters.jsCode;
    const tagAdsCode = wf2.nodes.find((n) => n.name === 'Tag Ad Signal Items').parameters.jsCode;
    const scoreCode = wf2.nodes.find((n) => n.name === 'Score Buying Intent (0-100)').parameters.jsCode;

    const batch = runCodeV2(buildCode, [
        { json: { accountName: 'Mistral AI', domain: 'https://www.mistral.ai/news', atsTarget: 'ashby:mistral', owner: 'Alice', active: 'true' } },
        { json: { accountName: 'Shopify', domain: 'shopify.com', atsTarget: 'Shopify', owner: 'Bob', active: true } },
        { json: { accountName: 'BBC & News <UK>', domain: 'bbc.co.uk', atsTarget: 'BBC', owner: 'Claire', active: 'true' } },
        { json: { accountName: 'Inactive Corp', domain: 'inactive.com', active: 'false' } },
    ]);

    assert.equal(batch[0].json.hasCompanies, true);
    assert.equal(batch[0].json.hasDomains, true);
    assert.deepEqual(batch[0].json.companies, ['ashby:mistral', 'Shopify', 'BBC']);
    assert.deepEqual(batch[0].json.targets, ['mistral.ai', 'shopify.com', 'bbc.co.uk']);

    const jobsTagged = runCodeV2(tagJobsCode, [
        { json: { jobId: 'ab:mistral:1', company: 'Mistral AI', companySlug: 'mistral', title: 'Staff Inference Engineer', seniority: 'staff', salaryAnnualUsdMax: 240000, salaryRaw: '$200K - $240K', techStack: ['Python', 'PyTorch', 'Kubernetes'], applyUrl: 'https://jobs.ashbyhq.com/mistral/1' } },
        { json: { jobId: 'ab:mistral:2', company: 'Mistral AI', companySlug: 'mistral', title: 'Senior Platform Engineer', seniority: 'senior', salaryAnnualUsdMax: 210000, salaryRaw: '$180K - $210K', techStack: ['Rust', 'Kubernetes'], applyUrl: 'https://jobs.ashbyhq.com/mistral/2' } },
        { json: { jobId: 'sr:bbc:1', company: 'BBC', companySlug: 'bbc', title: 'Lead Data Engineer', seniority: 'lead', techStack: ['Snowflake'], applyUrl: 'https://jobs.bbc.co.uk/1' } },
        { json: { jobId: 'gh:quiet:1', company: 'QuietCo', title: 'Office Coordinator', seniority: 'unknown', techStack: [], applyUrl: 'https://example.com/1' } },
    ]);
    const adsTagged = runCodeV2(tagAdsCode, [
        { json: { creativeId: 'CR1', advertiserName: 'Mistral AI SAS', domain: 'mistral.ai', target: 'mistral.ai', format: 'TEXT', firstShownDate: '2026-10-01', activeDays: 55, adUrl: 'https://adstransparency.google.com/1' } },
        { json: { creativeId: 'CR2', advertiserName: 'Shopify Inc.', domain: 'shopify.com', target: 'shopify.com', format: 'VIDEO', firstShownDate: '2026-11-20', activeDays: 6, adUrl: 'https://adstransparency.google.com/2' } },
        { json: { creativeId: 'CR3', advertiserName: 'Shopify Inc.', domain: 'shopify.com', target: 'shopify.com', format: 'TEXT', firstShownDate: '2026-11-21', activeDays: 5, adUrl: 'https://adstransparency.google.com/3' } },
        { json: { creativeId: 'CR4', advertiserName: 'British Broadcasting Corp', domain: 'bbc.co.uk', target: 'bbc.co.uk', format: 'VIDEO', firstShownDate: '2026-09-01', activeDays: 75, adUrl: 'https://adstransparency.google.com/4' } },
    ]);

    const scored = runCodeV2(scoreCode, [...jobsTagged, ...adsTagged], {
        'Filter & Build Batch Payloads': batch,
    });

    // Mistral AI (65 HOT), BBC (55 HOT — proves bbc.co.uk unified with BBC!), Shopify (30 WARM), QuietCo filtered
    assert.equal(scored.length, 3);
    assert.equal(scored[0].json.accountName, 'Mistral AI');
    assert.equal(scored[0].json.intentTier, 'HOT');
    assert.equal(scored[0].json.intentScore, 65);
    assert.equal(scored[1].json.accountName, 'BBC & News <UK>');
    assert.equal(scored[1].json.intentTier, 'HOT');
    assert.equal(scored[1].json.intentScore, 55);
    assert.equal(scored[1].json.newJobsCount, 1);
    assert.equal(scored[1].json.newAdsCount, 1);
    assert.match(scored[1].json.slackMessage, /BBC &amp; News &lt;UK&gt;/);
    assert.ok(scored[1].json.slackMessage.length <= 2800);
    assert.equal(scored[2].json.accountName, 'Shopify');
    assert.equal(scored[2].json.intentTier, 'WARM');

    // Partial HTTP failure + empty day resilience
    const failedJobs = runCodeV2(tagJobsCode, [{ json: { error: { message: 'Apify 504 Gateway Timeout' } } }]);
    assert.deepEqual(failedJobs, [{ json: { _signalType: 'empty' } }]);
    const partialScored = runCodeV2(scoreCode, [...failedJobs, ...adsTagged], { 'Filter & Build Batch Payloads': batch });
    assert.equal(partialScored.length, 3); // Ads alone still scored cleanly!

    // 0 active accounts resilience
    const emptyBatch = runCodeV2(buildCode, [{ json: { accountName: 'Paused', active: 'false' } }]);
    assert.equal(emptyBatch[0].json.hasCompanies, false);
    assert.equal(emptyBatch[0].json.hasDomains, false);
    const emptyScored = runCodeV2(scoreCode, [{ json: { _signalType: 'empty' } }, { json: { _signalType: 'empty' } }], { 'Filter & Build Batch Payloads': emptyBatch });
    assert.equal(emptyScored.length, 0);

    console.log('RUNTIME V2 OK: Workflow #2 (Mistral + multi-part TLD bbc.co.uk unification, Slack escaping/cap, HOT/WARM/QUIET, 0-account + partial-error resilience)');
}

// 7. Runtime simulation of all 5 quickstart Code v2 nodes (empty + populated payloads)
for (const quickFile of allWorkflowFiles.filter((f) => !FLAGSHIP.has(f))) {
    const wf = JSON.parse(readFileSync(join(ROOT, quickFile), 'utf8'));
    const codeNode = wf.nodes.find((n) => n.type === 'n8n-nodes-base.code');
    if (!codeNode) continue;
    const emptyOut = runCodeV2(codeNode.parameters.jsCode, []);
    assert.deepEqual(emptyOut, [], `${quickFile}: empty input must return []`);
    const sample = quickFile.includes('kyb')
        ? [{ json: { vat_or_id: 'FR22424761419' } }]
        : [{ json: { creativeId: '1', advertiserName: 'Acme', format: 'TEXT', adUrl: 'https://x', jobId: '1', company: 'Acme', ats: 'ashby', title: 'Eng', applyUrl: 'https://x', noticeId: '1', source: 'EU_TED', url: 'https://x', messageId: '1', channel: 'durov', text: 'hi', postUrl: 'https://t.me/durov/1' } }];
    const okOut = runCodeV2(codeNode.parameters.jsCode, sample);
    assert.equal(okOut.length, 1, `${quickFile}: sample input must return 1 item`);
}
console.log('RUNTIME V2 OK: All 5 quickstart templates (empty + sample payloads)');
console.log('ALL 7 WORKFLOWS PASSED 100%');
