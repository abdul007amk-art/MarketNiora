const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MASTER_4187_HEADERS,
  parseCsv,
  validateMaster4187Csv,
} = require('../backend/src/data/master4187Staging.ts');

function csv(rows: string[][]): string {
  return rows.map((row) => row.map((value) => {
    if (/[",\r\n]/.test(value)) return '"' + value.replaceAll('"', '""') + '"';
    return value;
  }).join(',')).join('\r\n') + '\r\n';
}

const header = [...MASTER_4187_HEADERS];

test('CSV parser supports BOM, quoted commas, escaped quotes and embedded newlines', () => {
  const parsed = parseCsv('\uFEFFa,b\r\n"Company, Limited","said ""hello"""\r\n"line 1\nline 2",tail\r\n');
  assert.deepEqual(parsed, [
    ['a', 'b'],
    ['Company, Limited', 'said "hello"'],
    ['line 1\nline 2', 'tail'],
  ]);
});

test('MASTER_4187 requires its exact seven-column header and expected row count', () => {
  assert.throws(
    () => validateMaster4187Csv(csv([['Wrong', ...header.slice(1)], ['S', 'SS', 'Company', 'Pending', 'NSE', 'ABC', 'NSE:ABC']]), 1),
    /Unexpected MASTER_4187 CSV headers/,
  );
  assert.throws(
    () => validateMaster4187Csv(csv([header, ['S', 'SS', 'Company', 'Pending', 'NSE', 'ABC', 'NSE:ABC']]), 2),
    /must contain exactly 2 data rows; received 1/,
  );
});

test('all rows sharing an exchange+symbol key are quarantined without dropping order', () => {
  const data = [
    header,
    ['Sector A', 'Sub A', 'Alpha Limited', 'Shariah', 'NSE', 'ABC', 'NSE:ABC'],
    ['Sector A', 'Sub A', 'Alpha Limited Duplicate', 'Shariah', 'NSE', 'ABC', 'NSE:ABC'],
    ['Sector B', 'Sub B', 'Beta Limited', 'Non-Shariah', 'BSE', 'ABC', 'BSE:ABC'],
    ['', 'Sub missing', 'ETL Tools Limited', 'Non-Shariah', 'NSE', 'ETL', 'NSE:ETL'],
  ];
  const plan = validateMaster4187Csv(csv(data), 4);

  assert.equal(plan.rows.length, 4);
  assert.deepEqual(plan.rows.map((row) => row.sourceRowNumber), [1, 2, 3, 4]);
  assert.equal(plan.duplicateGroups.length, 1);
  assert.deepEqual(plan.duplicateGroups[0], {
    exchange: 'NSE',
    symbol: 'ABC',
    sourceRowNumbers: [1, 2],
  });
  assert.equal(plan.duplicateSymbolRowCount, 2);
  assert.equal(plan.missingSectorRows.length, 1);
  assert.equal(plan.missingSectorRows[0].symbol, 'ETL');
  assert.deepEqual(plan.rows.map((row) => row.identityStatus), [
    'QUARANTINED',
    'QUARANTINED',
    'PENDING',
    'QUARANTINED',
  ]);
  assert.equal(plan.quarantinedRowCount, 3);
  assert.equal(plan.rows[0].shariahStatus, 'Shariah');
  assert.equal(plan.rows[1].name, 'Alpha Limited Duplicate');
  assert.equal(plan.rows[3].sector, null);
});

test('same symbol on different exchanges is not silently treated as an identity collision', () => {
  const data = [
    header,
    ['Sector A', 'Sub A', 'NSE Alpha', 'Pending', 'NSE', 'ABC', 'NSE:ABC'],
    ['Sector B', 'Sub B', 'BSE Alpha', 'Pending', 'BSE', 'ABC', 'BSE:ABC'],
  ];
  const plan = validateMaster4187Csv(csv(data), 2);
  assert.equal(plan.duplicateGroups.length, 0);
  assert.deepEqual(plan.rows.map((row) => row.identityStatus), ['PENDING', 'PENDING']);
});

test('blank required identity fields stop staging instead of being repaired', () => {
  const data = [
    header,
    ['Sector A', 'Sub A', 'Company', 'Pending', 'NSE', '', 'NSE:ABC'],
  ];
  assert.throws(() => validateMaster4187Csv(csv(data), 1), /blank required field: Symbol/);
});

test('an unterminated quoted field is rejected', () => {
  assert.throws(() => parseCsv('a,b\n"not closed,b\n'), /ends inside a quoted field/);
});
