import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const WORKFLOWS = [
    'eu-vendor-kyb-sanctions-compliance-gate.json',
    'b2b-account-buying-signals-pipeline.json',
];

function runJsCode(code, items, nodeLookup = {}) {
    const $ = (name) => ({
        all: () => nodeLookup[name] ?? [],
        first: () => (nodeLookup[name] ?? [])[0] ?? null,
    });
    const fn = new Function('items', '$', code);
    return fn(items, $);
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

for (const file of WORKFLOWS) {
    const raw = readFileSync(join(ROOT, file), 'utf8');
    const wf = JSON.parse(raw);

    // 1. Structural & n8n Creators publishing guidelines checks
    assert.ok(wf.name && wf.name.length >= 20, `${file}: descriptive workflow name required`);
    assert.equal(wf.settings?.executionOrder, 'v1', `${file}: executionOrder must be v1`);

    // No leaked tokens or personal info
    assert.ok(!/apify_api_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|xoxb-[A-Za-z0-9-]+|@gmail\.com|@outlook\./.test(raw), `${file}: leaked secret/personal data`);

    const ids = new Set();
    const names = new Set();
    const functionalNodes = [];
    const stickyNotes = [];

    for (const node of wf.nodes) {
        assert.ok(node.id && !ids.has(node.id), `${file}: duplicate/missing node id ${node.id}`);
        assert.ok(node.name && !names.has(node.name), `${file}: duplicate/missing node name ${node.name}`);
        ids.add(node.id);
        names.add(node.name);

        // No generic default node names
        assert.ok(!/^(HTTP Request|Code|If|Switch|Slack|Google Sheets|Merge)\d*$/i.test(node.name), `${file}: generic node name ${node.name}`);

        walkExpressions(node.parameters, `${file}:${node.name}`);

        if (node.type === 'n8n-nodes-base.stickyNote') stickyNotes.push(node);
        else functionalNodes.push(node);
    }

    assert.ok(functionalNodes.length >= 12, `${file}: expected >= 12 functional nodes, got ${functionalNodes.length}`);
    assert.ok(stickyNotes.length >= 4, `${file}: expected >= 4 sticky notes (overview + stages), got ${stickyNotes.length}`);

    const overview = stickyNotes.find((n) => /### How it works/.test(n.parameters.content));
    assert.ok(overview, `${file}: missing overview sticky note with "### How it works"`);
    assert.ok(/### Setup/.test(overview.parameters.content), `${file}: overview sticky note missing "### Setup"`);
    assert.ok(/### Customization/.test(overview.parameters.content), `${file}: overview sticky note missing "### Customization"`);
    const overviewWords = overview.parameters.content.trim().split(/\s+/).length;
    assert.ok(overviewWords >= 100 && overviewWords <= 300, `${file}: overview sticky note should be 100-300 words (got ${overviewWords})`);

    // Verify every functional node sits inside a stage sticky note and outside the overview sticky note
    const stageNotes = stickyNotes.filter((n) => n !== overview);
    const inBox = ([x, y], note) => {
        const [nx, ny] = note.position;
        const w = note.parameters.width || 300;
        const h = note.parameters.height || 300;
        return x >= nx + 20 && x + 100 <= nx + w - 10 && y >= ny + 60 && y + 100 <= ny + h - 10;
    };
    for (const node of functionalNodes) {
        assert.ok(!inBox(node.position, overview), `${file}: node "${node.name}" overlaps overview sticky note`);
        const insideStage = stageNotes.some((s) => inBox(node.position, s));
        assert.ok(insideStage, `${file}: node "${node.name}" at [${node.position}] is outside all stage sticky notes`);
    }

    // Verify all connections point to real nodes & no orphaned functional nodes
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

    // Verify no overlapping functional node positions (minimum 100px distance)
    for (let i = 0; i < functionalNodes.length; i++) {
        for (let j = i + 1; j < functionalNodes.length; j++) {
            const [x1, y1] = functionalNodes[i].position;
            const [x2, y2] = functionalNodes[j].position;
            const dist = Math.hypot(x1 - x2, y1 - y2);
            assert.ok(dist >= 100, `${file}: nodes "${functionalNodes[i].name}" and "${functionalNodes[j].name}" overlap (dist=${Math.round(dist)})`);
        }
    }

    console.log(`STRUCTURAL OK: ${file} (${functionalNodes.length} functional nodes, ${stickyNotes.length} sticky notes)`);
}

// 2. Functional execution simulation of Workflow #1 (KYB, VAT & Sanctions)
{
    const wf1 = JSON.parse(readFileSync(join(ROOT, WORKFLOWS[0]), 'utf8'));
    const validateCode = wf1.nodes.find((n) => n.id === 'code-validate-input').parameters.jsCode;
    const decisionCode = wf1.nodes.find((n) => n.id === 'code-compliance-decision').parameters.jsCode;

    const validated = runJsCode(validateCode, [
        { json: { 'Vendor Identifier or Legal Name': ' FR22424761419 ', 'Country (ISO-2, optional)': 'fr', 'Estimated Annual Spend (EUR)': '15000', 'Requester Email': 'ops@example.com' } },
        { json: { 'Vendor Identifier or Legal Name': 'x', 'Requester Email': 'bad@example.com' } },
        { json: { query: 'Sberbank of Russia', annualSpendEur: 12000, requesterEmail: 'buyer@example.com' } },
        { json: { query: 'Mistral AI', defaultCountry: 'FR', annualSpendEur: 80000, requesterEmail: 'cfo@example.com' } },
        { json: { query: 'CHE-105.909.036', annualSpendEur: 5000, requesterEmail: 'eu@example.com' } },
    ]);

    assert.equal(validated[0].json.isValid, true);
    assert.equal(validated[0].json.query, 'FR22424761419');
    assert.equal(validated[0].json.defaultCountry, 'FR');
    assert.equal(validated[1].json.isValid, false);
    assert.ok(validated[1].json.validationError);

    // Simulate realistic Apify outputs AFTER invalid row #1 was filtered out by the IF node!
    const decisions = runJsCode(
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
        ],
        { 'Normalize & Validate Vendor Input': validated },
    );

    assert.equal(decisions[0].json.complianceDecision, 'APPROVED');
    assert.equal(decisions[0].json.riskScore, 0);
    assert.equal(decisions[0].json.requesterEmail, 'ops@example.com');

    assert.equal(decisions[1].json.complianceDecision, 'BLOCKED');
    assert.equal(decisions[1].json.riskScore, 100);
    assert.equal(decisions[1].json.requesterEmail, 'buyer@example.com'); // Proves query-keyed alignment survived filtered invalid row!

    assert.equal(decisions[2].json.complianceDecision, 'MANUAL_REVIEW'); // VIES outage + 80k EUR spend -> NEVER falsely blocked!
    assert.equal(decisions[2].json.annualSpendEur, 80000);
    assert.match(decisions[2].json.decisionReasons, /VIES temporarily unavailable/);
    assert.match(decisions[2].json.decisionReasons, /High-value vendor/);

    assert.equal(decisions[3].json.complianceDecision, 'BLOCKED'); // Inactive company blocked!

    // Valid Swiss non-EU entity (vatValid=null without VAT_UNVERIFIED flag -> APPROVED with vatValid='N/A')
    const swissValidated = runJsCode(validateCode, [
        { json: { query: 'CHE-105.909.036', defaultCountry: 'CH', annualSpendEur: 12000, requesterEmail: 'ch@example.com' } },
    ]);
    const swissDecision = runJsCode(
        decisionCode,
        [
            {
                json: {
                    query: 'CHE-105.909.036', found: true, kybStatus: 'VERIFIED_ACTIVE', kybRiskFlags: [],
                    country: 'CH', legalName: 'Swiss Active AG', registrationNumber: 'CHE-105.909.036',
                    vatValid: null, status: 'ACTIVE', sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] },
                },
            },
        ],
        { 'Normalize & Validate Vendor Input': swissValidated },
    );
    assert.equal(swissDecision[0].json.complianceDecision, 'APPROVED');
    assert.equal(swissDecision[0].json.vatValid, 'N/A');

    console.log('RUNTIME SIMULATION OK: Workflow #1 (APPROVED EU+CH, BLOCKED-sanctions, MANUAL_REVIEW-VIES+spend, BLOCKED-inactive, invalid-row alignment)');
}

// 3. Functional execution simulation of Workflow #2 (Multi-Signal B2B Buying Intent Radar)
{
    const wf2 = JSON.parse(readFileSync(join(ROOT, WORKFLOWS[1]), 'utf8'));
    const buildCode = wf2.nodes.find((n) => n.id === 'radar-build-batch').parameters.jsCode;
    const tagJobsCode = wf2.nodes.find((n) => n.id === 'radar-tag-jobs').parameters.jsCode;
    const tagAdsCode = wf2.nodes.find((n) => n.id === 'radar-tag-ads').parameters.jsCode;
    const scoreCode = wf2.nodes.find((n) => n.id === 'radar-score-intent').parameters.jsCode;

    const batch = runJsCode(buildCode, [
        { json: { accountName: 'Mistral AI', domain: 'https://www.mistral.ai/news', atsTarget: 'ashby:mistral', owner: 'Alice', active: 'true' } },
        { json: { accountName: 'Shopify', domain: 'shopify.com', atsTarget: 'Shopify', owner: 'Bob', active: true } },
        { json: { accountName: 'Inactive Corp', domain: 'inactive.com', active: 'false' } },
        { json: { accountName: '', domain: '' } },
    ]);

    assert.equal(batch[0].json.hasCompanies, true);
    assert.equal(batch[0].json.hasDomains, true);
    assert.deepEqual(batch[0].json.companies, ['ashby:mistral', 'Shopify']);
    assert.deepEqual(batch[0].json.targets, ['mistral.ai', 'shopify.com']);

    // Simulate empty ads day -> Tag Ad Signal Items must emit sentinel so Merge never stalls!
    const emptyAdsTagged = runJsCode(tagAdsCode, [{ json: {} }]);
    assert.deepEqual(emptyAdsTagged, [{ json: { _signalType: 'empty' } }]);

    // Simulate real merged hiring + ads signals (testing Mistral AI alias unification across "Mistral AI" + "mistral.ai"!)
    const jobsTagged = runJsCode(tagJobsCode, [
        { json: { jobId: 'ab:mistral:1', company: 'Mistral AI', companySlug: 'mistral', title: 'Staff Inference Engineer', seniority: 'staff', salaryAnnualUsdMax: 240000, salaryRaw: '$200K - $240K', techStack: ['Python', 'PyTorch', 'Kubernetes'], applyUrl: 'https://jobs.ashbyhq.com/mistral/1' } },
        { json: { jobId: 'ab:mistral:2', company: 'Mistral AI', companySlug: 'mistral', title: 'Senior Platform Engineer', seniority: 'senior', salaryAnnualUsdMax: 210000, salaryRaw: '$180K - $210K', techStack: ['Rust', 'Kubernetes'], applyUrl: 'https://jobs.ashbyhq.com/mistral/2' } },
        { json: { jobId: 'gh:quiet:1', company: 'QuietCo', title: 'Office Coordinator', seniority: 'unknown', techStack: [], applyUrl: 'https://example.com/1' } },
    ]);
    const adsTagged = runJsCode(tagAdsCode, [
        { json: { creativeId: 'CR1', advertiserName: 'Mistral AI SAS', domain: 'mistral.ai', target: 'mistral.ai', format: 'TEXT', firstShownDate: '2026-10-01', activeDays: 55, adUrl: 'https://adstransparency.google.com/1' } },
        { json: { creativeId: 'CR2', advertiserName: 'Shopify Inc.', domain: 'shopify.com', target: 'shopify.com', format: 'VIDEO', firstShownDate: '2026-11-20', activeDays: 6, adUrl: 'https://adstransparency.google.com/2' } },
        { json: { creativeId: 'CR3', advertiserName: 'Shopify Inc.', domain: 'shopify.com', target: 'shopify.com', format: 'TEXT', firstShownDate: '2026-11-21', activeDays: 5, adUrl: 'https://adstransparency.google.com/3' } },
    ]);

    const scored = runJsCode(scoreCode, [...jobsTagged, ...adsTagged], {
        'Filter & Build Batch Payloads': batch,
    });

    // Mistral AI should unify both jobs + ad into ONE HOT account (score = 20 + 15 + 10 + 10 + 10 = 65)
    assert.equal(scored.length, 2, 'QuietCo (score 10) must be filtered out, Mistral AI + Shopify kept');
    assert.equal(scored[0].json.accountName, 'Mistral AI');
    assert.equal(scored[0].json.owner, 'Alice');
    assert.equal(scored[0].json.intentTier, 'HOT');
    assert.equal(scored[0].json.intentScore, 65);
    assert.equal(scored[0].json.newJobsCount, 2);
    assert.equal(scored[0].json.newAdsCount, 1);

    // Shopify: 2 multi-format ads = 20 + 10 = 30 -> WARM
    assert.equal(scored[1].json.accountName, 'Shopify');
    assert.equal(scored[1].json.owner, 'Bob');
    assert.equal(scored[1].json.intentTier, 'WARM');
    assert.equal(scored[1].json.intentScore, 30);

    // Edge case 1: 0 active accounts -> both IF gates false -> 2 empty sentinels -> 0 scored outputs
    const emptyBatch = runJsCode(buildCode, [{ json: { accountName: 'Paused Inc', active: 'false' } }]);
    assert.equal(emptyBatch[0].json.hasCompanies, false);
    assert.equal(emptyBatch[0].json.hasDomains, false);
    const emptyScored = runJsCode(
        scoreCode,
        [{ json: { _signalType: 'empty' } }, { json: { _signalType: 'empty' } }],
        { 'Filter & Build Batch Payloads': emptyBatch },
    );
    assert.equal(emptyScored.length, 0);

    // Edge case 2: ATS HTTP error diverted to Tag Hiring Signal Items -> emits empty sentinel, Ads signals still scored cleanly!
    const failedJobsTagged = runJsCode(tagJobsCode, [{ json: { error: { message: 'Apify 504 Gateway Timeout' } } }]);
    assert.deepEqual(failedJobsTagged, [{ json: { _signalType: 'empty' } }]);
    const partialScored = runJsCode(scoreCode, [...failedJobsTagged, ...adsTagged], {
        'Filter & Build Batch Payloads': batch,
    });
    assert.equal(partialScored.length, 2); // Mistral AI (score 20: 1 evergreen ad) + Shopify (score 30: 2 multi-format ads)
    assert.equal(partialScored[0].json.accountName, 'Shopify');
    assert.equal(partialScored[0].json.intentTier, 'WARM');

    console.log('RUNTIME SIMULATION OK: Workflow #2 (alias unification Mistral AI + mistral.ai, HOT/WARM/QUIET tiers, empty-day + 0-account + partial-error resilience)');
}

console.log('ALL WORKFLOW VALIDATIONS PASSED 100%');
