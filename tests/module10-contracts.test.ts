const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateProvenance } = require('../backend/src/contracts/provenance.ts');
const { getSpecialPeers, validateUniversePeerLink, getUniversePeers } = require('../backend/src/contracts/peers.ts');
const { validateSubTheme, validateIndustry, validateStockThemeMembership, getThemesForStock, getStocksForIndustry } = require('../backend/src/contracts/theme.ts');
const { classifyFundamentalStatus, validateFundamentalMetricRecord, FUNDAMENTAL_METRICS } = require('../backend/src/contracts/fundamental.ts');
const { VALUE_CHAIN_STAGES, validateValueChainEntry, orderByStage, validateCausalLink } = require('../backend/src/contracts/valueChain.ts');

const NOW = 1_700_000_000_000;
const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 100; // 100 days — typical fundamental reporting cadence

function makeProvenance(overrides = {}) {
  return {
    source: 'TEST_SOURCE',
    sourceTimestamp: NOW - 1000,
    verificationStatus: 'VERIFIED',
    dataNature: 'RAW',
    formulaVersion: null,
    ...overrides,
  };
}

// ================= PROVENANCE (Finding 10-B foundation) =================

test('validateProvenance: valid RAW provenance accepted', () => {
  assert.equal(validateProvenance(makeProvenance()).valid, true);
});

test('validateProvenance: invalid verificationStatus rejected', () => {
  assert.equal(validateProvenance(makeProvenance({ verificationStatus: 'MADE_UP' })).valid, false);
});

test('validateProvenance: invalid dataNature rejected', () => {
  assert.equal(validateProvenance(makeProvenance({ dataNature: 'MADE_UP' })).valid, false);
});

test('validateProvenance: DERIVED without formulaVersion rejected; DERIVED with formulaVersion accepted', () => {
  assert.equal(validateProvenance(makeProvenance({ dataNature: 'DERIVED', formulaVersion: null })).valid, false);
  assert.equal(validateProvenance(makeProvenance({ dataNature: 'DERIVED', formulaVersion: 'SS-1.0-R3' })).valid, true);
});

test('validateProvenance: non-DERIVED with a non-null formulaVersion rejected', () => {
  assert.equal(validateProvenance(makeProvenance({ dataNature: 'RAW', formulaVersion: 'X' })).valid, false);
});

test('validateProvenance: non-finite sourceTimestamp rejected; null sourceTimestamp accepted', () => {
  assert.equal(validateProvenance(makeProvenance({ sourceTimestamp: NaN })).valid, false);
  assert.equal(validateProvenance(makeProvenance({ sourceTimestamp: null })).valid, true);
});

// ================= PEERS =================

test('getSpecialPeers: same-group stocks returned, self excluded', () => {
  const memberships = [
    { stockId: 'A', groupId: 'G1' },
    { stockId: 'B', groupId: 'G1' },
    { stockId: 'C', groupId: 'G1' },
    { stockId: 'D', groupId: 'G2' },
  ];
  const peers = getSpecialPeers('A', memberships);
  assert.deepEqual(new Set(peers), new Set(['B', 'C']));
  assert.equal(peers.includes('A'), false);
});

test('getSpecialPeers: stock in multiple groups gets peers from ANY shared group', () => {
  const memberships = [
    { stockId: 'A', groupId: 'G1' },
    { stockId: 'A', groupId: 'G2' },
    { stockId: 'B', groupId: 'G1' },
    { stockId: 'C', groupId: 'G2' },
  ];
  assert.deepEqual(new Set(getSpecialPeers('A', memberships)), new Set(['B', 'C']));
});

test('getSpecialPeers: stock in no group returns empty list, does not throw', () => {
  assert.deepEqual(getSpecialPeers('LONER', [{ stockId: 'A', groupId: 'G1' }]), []);
});

test('validateUniversePeerLink (post-10-B): self-reference rejected', () => {
  const result = validateUniversePeerLink({ stockId: 'A', peerStockId: 'A', provenance: makeProvenance() });
  assert.equal(result.valid, false);
});

test('validateUniversePeerLink (post-10-B): valid distinct pair with valid provenance accepted', () => {
  const result = validateUniversePeerLink({ stockId: 'A', peerStockId: 'B', provenance: makeProvenance() });
  assert.equal(result.valid, true);
});

test('validateUniversePeerLink (post-10-B): invalid provenance propagates as an error', () => {
  const result = validateUniversePeerLink({ stockId: 'A', peerStockId: 'B', provenance: makeProvenance({ verificationStatus: 'BOGUS' }) });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('provenance:')));
});

test('getUniversePeers: returns configured competitors, excludes any accidental self-link', () => {
  const links = [
    { stockId: 'A', peerStockId: 'B', provenance: makeProvenance() },
    { stockId: 'A', peerStockId: 'C', provenance: makeProvenance() },
    { stockId: 'A', peerStockId: 'A', provenance: makeProvenance() },
    { stockId: 'B', peerStockId: 'A', provenance: makeProvenance() },
  ];
  assert.deepEqual(new Set(getUniversePeers('A', links)), new Set(['B', 'C']));
});

// ================= THEME =================

test('validateSubTheme: rejects unknown themeId', () => {
  const themes = [{ themeId: 'T1', name: 'Defence' }];
  assert.equal(validateSubTheme({ subThemeId: 'S1', themeId: 'T_UNKNOWN', name: 'Naval' }, themes).valid, false);
});

test('validateIndustry: rejects unknown subThemeId', () => {
  const subThemes = [{ subThemeId: 'S1', themeId: 'T1', name: 'Naval' }];
  assert.equal(validateIndustry({ industryId: 'I1', subThemeId: 'S_UNKNOWN', name: 'Shipbuilding' }, subThemes).valid, false);
});

test('validateStockThemeMembership (post-10-B, new): valid membership with provenance accepted', () => {
  const result = validateStockThemeMembership({ stockId: 'A', industryId: 'I1', provenance: makeProvenance() });
  assert.equal(result.valid, true);
});

test('validateStockThemeMembership: missing stockId/industryId rejected', () => {
  assert.equal(validateStockThemeMembership({ stockId: '', industryId: 'I1', provenance: makeProvenance() }).valid, false);
  assert.equal(validateStockThemeMembership({ stockId: 'A', industryId: '', provenance: makeProvenance() }).valid, false);
});

test('validateStockThemeMembership: invalid provenance propagates as an error', () => {
  const result = validateStockThemeMembership({ stockId: 'A', industryId: 'I1', provenance: makeProvenance({ dataNature: 'BOGUS' }) });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('provenance:')));
});

test('getThemesForStock: resolves many-to-many through industry -> sub-theme -> theme', () => {
  const themes = [{ themeId: 'T1', name: 'Defence' }, { themeId: 'T2', name: 'Renewables' }];
  const subThemes = [
    { subThemeId: 'S1', themeId: 'T1', name: 'Naval' },
    { subThemeId: 'S2', themeId: 'T2', name: 'Solar' },
  ];
  const industries = [
    { industryId: 'I1', subThemeId: 'S1', name: 'Shipbuilding' },
    { industryId: 'I2', subThemeId: 'S2', name: 'Panel Manufacturing' },
  ];
  const memberships = [
    { stockId: 'STOCK_X', industryId: 'I1', provenance: makeProvenance() },
    { stockId: 'STOCK_X', industryId: 'I2', provenance: makeProvenance() },
  ];
  const result = getThemesForStock('STOCK_X', memberships, industries, subThemes);
  assert.deepEqual(new Set(result), new Set(['T1', 'T2']));
});

test('getStocksForIndustry: reverse query, deduplicated', () => {
  const memberships = [
    { stockId: 'A', industryId: 'I1', provenance: makeProvenance() },
    { stockId: 'B', industryId: 'I1', provenance: makeProvenance() },
    { stockId: 'A', industryId: 'I1', provenance: makeProvenance() },
  ];
  assert.deepEqual(new Set(getStocksForIndustry('I1', memberships)), new Set(['A', 'B']));
});

test('theme.ts exports only the expected functions — no Theme Score function has been added (scope lock)', () => {
  const source = fs.readFileSync('backend/src/contracts/theme.ts', 'utf8');
  const exported = new Set([...source.matchAll(/export function (\w+)/g)].map((m) => m[1]));
  assert.deepEqual(exported, new Set(['validateStockThemeMembership', 'validateSubTheme', 'validateIndustry', 'getThemesForStock', 'getStocksForIndustry']));
});

// ================= FUNDAMENTAL =================

test('classifyFundamentalStatus (10-C): null value, no source -> MISSING', () => {
  assert.equal(classifyFundamentalStatus(null, null, null, NOW, STALE_THRESHOLD_MS), 'MISSING');
});

test('classifyFundamentalStatus (10-C): null value, has source -> SOURCE_REQUIRED', () => {
  assert.equal(classifyFundamentalStatus(null, 'Annual Report FY24', null, NOW, STALE_THRESHOLD_MS), 'SOURCE_REQUIRED');
});

test('classifyFundamentalStatus (10-C): non-finite value -> UNKNOWN', () => {
  assert.equal(classifyFundamentalStatus(NaN, 'source', NOW - 1000, NOW, STALE_THRESHOLD_MS), 'UNKNOWN');
  assert.equal(classifyFundamentalStatus(Infinity, 'source', NOW - 1000, NOW, STALE_THRESHOLD_MS), 'UNKNOWN');
});

test('classifyFundamentalStatus (10-C): finite value but no sourceTimestamp -> UNKNOWN (cannot assess currency)', () => {
  assert.equal(classifyFundamentalStatus(18.5, 'source', null, NOW, STALE_THRESHOLD_MS), 'UNKNOWN');
});

test('classifyFundamentalStatus (10-C): finite value with recent sourceTimestamp -> LIVE (delegates to classifyFreshness)', () => {
  assert.equal(classifyFundamentalStatus(18.5, 'source', NOW - 1000, NOW, STALE_THRESHOLD_MS), 'LIVE');
});

test('classifyFundamentalStatus (10-C): finite value with old sourceTimestamp beyond threshold -> STALE', () => {
  const oldTimestamp = NOW - STALE_THRESHOLD_MS - 1000;
  assert.equal(classifyFundamentalStatus(18.5, 'source', oldTimestamp, NOW, STALE_THRESHOLD_MS), 'STALE');
});

test('classifyFundamentalStatus (10-C): only returns values from the canonical 7-state vocabulary, never an invented term', () => {
  const canonical = new Set(['LIVE', 'DELAYED', 'STALE', 'MISSING', 'NOT_INTERPRETABLE', 'SOURCE_REQUIRED', 'UNKNOWN']);
  const probes = [
    classifyFundamentalStatus(null, null, null, NOW, STALE_THRESHOLD_MS),
    classifyFundamentalStatus(null, 'x', null, NOW, STALE_THRESHOLD_MS),
    classifyFundamentalStatus(NaN, 'x', NOW, NOW, STALE_THRESHOLD_MS),
    classifyFundamentalStatus(10, 'x', null, NOW, STALE_THRESHOLD_MS),
    classifyFundamentalStatus(10, 'x', NOW - 1000, NOW, STALE_THRESHOLD_MS),
    classifyFundamentalStatus(10, 'x', NOW - STALE_THRESHOLD_MS - 1, NOW, STALE_THRESHOLD_MS),
  ];
  for (const p of probes) assert.ok(canonical.has(p), `${p} must be one of the canonical 7 states`);
});

function makeFundamentalRecord(overrides = {}) {
  return {
    stockId: 'A',
    metric: 'ROE',
    value: 18.5,
    period: 'FY24',
    status: 'LIVE',
    provenance: makeProvenance(),
    trend: null,
    rootCause: null,
    positiveSignals: [],
    warningSignals: [],
    relatedMetrics: [],
    context: null,
    verdict: null,
    ...overrides,
  };
}

test('validateFundamentalMetricRecord: unknown metric name rejected', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord({ metric: 'MADE_UP_METRIC' }), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, false);
});

test('validateFundamentalMetricRecord: status inconsistent with value/source/timestamp rejected', () => {
  const result = validateFundamentalMetricRecord(
    makeFundamentalRecord({ value: null, status: 'LIVE', provenance: makeProvenance({ source: null, sourceTimestamp: null }) }),
    NOW,
    STALE_THRESHOLD_MS
  );
  assert.equal(result.valid, false);
});

test('validateFundamentalMetricRecord: consistent record accepted', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord(), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, true);
});

test('validateFundamentalMetricRecord (10-A): relatedMetrics containing an unknown metric name rejected', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord({ relatedMetrics: ['ROE', 'NOT_A_METRIC'] }), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, false);
});

test('validateFundamentalMetricRecord (10-A): relatedMetrics with only valid metric names accepted', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord({ relatedMetrics: ['ROE', 'PEG'] }), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, true);
});

test('validateFundamentalMetricRecord (10-A): verdict present without context is rejected — no conclusion without stated evidence', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord({ verdict: 'Improving fundamentals', context: null }), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, false);
});

test('validateFundamentalMetricRecord (10-A): verdict present WITH context is accepted', () => {
  const result = validateFundamentalMetricRecord(
    makeFundamentalRecord({ verdict: 'Improving fundamentals', context: 'ROE trending up 3 consecutive quarters vs peer average' }),
    NOW,
    STALE_THRESHOLD_MS
  );
  assert.equal(result.valid, true);
});

test('validateFundamentalMetricRecord: invalid provenance propagates as a prefixed error', () => {
  const result = validateFundamentalMetricRecord(makeFundamentalRecord({ provenance: makeProvenance({ verificationStatus: 'BOGUS' }) }), NOW, STALE_THRESHOLD_MS);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('provenance:')));
});

test('FUNDAMENTAL_METRICS: contains all 19 metrics named in the Master Guide', () => {
  assert.equal(FUNDAMENTAL_METRICS.length, 19);
  for (const expected of ['REVENUE', 'PEG', 'ROE', 'CFO', 'FCF', 'WORKING_CAPITAL', 'CAPITAL_EFFICIENCY']) {
    assert.ok(FUNDAMENTAL_METRICS.includes(expected));
  }
});

test('fundamental.ts exports only the expected functions — no scoring/verdict-COMPUTATION function has been added (scope lock)', () => {
  const source = fs.readFileSync('backend/src/contracts/fundamental.ts', 'utf8');
  const exported = new Set([...source.matchAll(/export function (\w+)/g)].map((m) => m[1]));
  assert.deepEqual(exported, new Set(['classifyFundamentalStatus', 'validateFundamentalMetricRecord']));
});

test('fundamental.ts: no function ever WRITES a hardcoded verdict string — verdict can only arrive as externally-supplied data', () => {
  const source = fs.readFileSync('backend/src/contracts/fundamental.ts', 'utf8');
  const suspiciousAssignment = /\bverdict\s*[:=]\s*['"`]/;
  assert.equal(suspiciousAssignment.test(source), false, 'no hardcoded/computed verdict string literal should ever be assigned');
});

// ================= VALUE CHAIN =================

test('VALUE_CHAIN_STAGES: exactly 10 stages, matches schema.sql order', () => {
  assert.equal(VALUE_CHAIN_STAGES.length, 10);
  assert.equal(VALUE_CHAIN_STAGES[0], 'RAW_MATERIAL_INPUT');
  assert.equal(VALUE_CHAIN_STAGES[VALUE_CHAIN_STAGES.length - 1], 'FINAL_END_USE');
});

test('VALUE_CHAIN_STAGES is represented by the authoritative value-chain table schema', () => {
  const schema = fs.readFileSync('database/schema.sql', 'utf8');
  assert.ok(schema.includes('CREATE TABLE production_layer.value_chain_stage'), 'schema.sql must define value_chain_stage');
  assert.ok(schema.includes('stage_name text NOT NULL'), 'schema.sql must define required stage_name');
  assert.equal(schema.includes('value_chain_stage_stage_name_check'), false, 'authoritative Prisma-generated schema must not invent a CHECK constraint absent from Prisma');
});

test('validateValueChainEntry (post-10-B): unknown stage rejected', () => {
  const result = validateValueChainEntry({ stockId: 'A', stage: 'NOT_A_REAL_STAGE', detail: null, provenance: makeProvenance() });
  assert.equal(result.valid, false);
});

test('validateValueChainEntry (post-10-B): valid entry with valid provenance accepted', () => {
  const result = validateValueChainEntry({ stockId: 'A', stage: 'PROCESSING', detail: null, provenance: makeProvenance() });
  assert.equal(result.valid, true);
});

test('validateValueChainEntry (post-10-B): invalid provenance propagates as an error', () => {
  const result = validateValueChainEntry({ stockId: 'A', stage: 'PROCESSING', detail: null, provenance: makeProvenance({ dataNature: 'BOGUS' }) });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('provenance:')));
});

test('orderByStage: reorders entries into canonical sequence regardless of input order', () => {
  const entries = [
    { stockId: 'A', stage: 'FINAL_END_USE', detail: null, provenance: makeProvenance() },
    { stockId: 'A', stage: 'RAW_MATERIAL_INPUT', detail: null, provenance: makeProvenance() },
    { stockId: 'A', stage: 'MANUFACTURING', detail: null, provenance: makeProvenance() },
  ];
  const ordered = orderByStage(entries);
  assert.deepEqual(ordered.map((e) => e.stage), ['RAW_MATERIAL_INPUT', 'MANUFACTURING', 'FINAL_END_USE']);
});

test('validateCausalLink: missing evidenceSource rejected — no evidence, no causal claim', () => {
  const result = validateCausalLink({ fromStage: 'RAW_MATERIAL_INPUT', toStage: 'PROCESSING', description: 'Input price rise increases cost', evidenceSource: '' });
  assert.equal(result.valid, false);
});

test('validateCausalLink: complete, evidenced link accepted', () => {
  const result = validateCausalLink({ fromStage: 'RAW_MATERIAL_INPUT', toStage: 'PROCESSING', description: 'Input price rise increases processing cost', evidenceSource: 'Q3 earnings call transcript' });
  assert.equal(result.valid, true);
});

// ================= ISOLATION (structural, same convention as Module 8/9) =================

test('Module 10 isolation: no contract file imports rotationEngine.ts or stockScoreEngine.ts', () => {
  const files = ['peers.ts', 'theme.ts', 'fundamental.ts', 'valueChain.ts', 'provenance.ts'];
  for (const file of files) {
    const source = fs.readFileSync(`backend/src/contracts/${file}`, 'utf8');
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.equal(/rotationEngine|stockScoreEngine/.test(withoutComments), false, `${file} must not import the locked engines (outside comments)`);
  }
});
