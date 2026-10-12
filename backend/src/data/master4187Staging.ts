/**
 * Immutable MASTER_4187 source validation and staging plan.
 *
 * This module only normalizes the source into a reversible staging payload.
 * It never writes to canonical stock, Shariah, rotation, or score tables.
 */
export const EXPECTED_MASTER_4187_ROWS = 4187;

export const MASTER_4187_HEADERS = [
  'Sector',
  'Sub-Sector',
  'Stock',
  'Shariah Status',
  'Exchange',
  'Symbol',
  'Google Finance Ticker',
] as const;

export type StagingIdentityStatus = 'PENDING' | 'QUARANTINED';

export interface Master4187StagingRow {
  /** 1-based data-row position after the CSV header, preserving master order. */
  sourceRowNumber: number;
  name: string;
  symbol: string;
  exchange: string;
  sector: string | null;
  subSector: string | null;
  /** Raw source label only; must not be promoted to production Shariah status. */
  shariahStatus: string | null;
  googleFinanceTicker: string | null;
  identityStatus: StagingIdentityStatus;
}

export interface Master4187DuplicateGroup {
  exchange: string;
  symbol: string;
  sourceRowNumbers: number[];
}

export interface Master4187StagingPlan {
  rows: Master4187StagingRow[];
  duplicateGroups: Master4187DuplicateGroup[];
  missingSectorRows: Master4187StagingRow[];
  duplicateSymbolRowCount: number;
  quarantinedRowCount: number;
}

/** RFC-4180-style CSV parser supporting quoted commas, escaped quotes and newlines. */
export function parseCsv(input: string): string[][] {
  if (typeof input !== 'string') throw new Error('CSV input must be text.');
  const csv = input.startsWith('\uFEFF') ? input.slice(1) : input;
  if (csv.length === 0) throw new Error('CSV input is empty.');

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];

    if (quoted) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (field.length !== 0) {
        throw new Error(`Unexpected quote in unquoted CSV field near character ${i + 1}.`);
      }
      quoted = true;
      continue;
    }

    if (ch === ',') {
      record.push(field);
      field = '';
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (ch === '\r' && csv[i + 1] === '\n') i += 1;
      continue;
    }

    field += ch;
  }

  if (quoted) throw new Error('CSV input ends inside a quoted field.');
  if (record.length > 0 || field.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

function optionalCell(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredCell(value: string, label: string, rowNumber: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`MASTER_4187 source row ${rowNumber} has a blank required field: ${label}.`);
  return trimmed;
}

/**
 * Validates a CSV exported from the workbook's MASTER_4187 sheet.
 * Data issues that can be quarantined are retained in original order rather
 * than silently dropped, renamed, or assigned inferred classifications.
 */
export function validateMaster4187Csv(
  csvText: string,
  expectedRowCount: number = EXPECTED_MASTER_4187_ROWS,
): Master4187StagingPlan {
  if (!Number.isInteger(expectedRowCount) || expectedRowCount < 1) {
    throw new Error('Expected row count must be a positive integer.');
  }

  const parsed = parseCsv(csvText);
  if (parsed.length === 0) throw new Error('CSV has no header row.');

  const headers = parsed[0].map((value) => value.trim());
  if (headers.length !== MASTER_4187_HEADERS.length ||
      !MASTER_4187_HEADERS.every((expected, index) => headers[index] === expected)) {
    throw new Error(
      'Unexpected MASTER_4187 CSV headers. Expected exactly: ' + MASTER_4187_HEADERS.join(', '),
    );
  }

  const sourceRows = parsed.slice(1);
  if (sourceRows.length !== expectedRowCount) {
    throw new Error(
      `MASTER_4187 must contain exactly ${expectedRowCount} data rows; received ${sourceRows.length}. ` +
      'No rows were staged.',
    );
  }

  const rows: Master4187StagingRow[] = sourceRows.map((cells, index) => {
    const sourceRowNumber = index + 1;
    if (cells.length !== MASTER_4187_HEADERS.length) {
      throw new Error(
        `MASTER_4187 source row ${sourceRowNumber} has ${cells.length} fields; expected ${MASTER_4187_HEADERS.length}. ` +
        'No rows were staged.',
      );
    }

    return {
      sourceRowNumber,
      sector: optionalCell(cells[0]),
      subSector: optionalCell(cells[1]),
      name: requiredCell(cells[2], 'Stock', sourceRowNumber),
      shariahStatus: optionalCell(cells[3]),
      exchange: requiredCell(cells[4], 'Exchange', sourceRowNumber),
      symbol: requiredCell(cells[5], 'Symbol', sourceRowNumber),
      googleFinanceTicker: optionalCell(cells[6]),
      identityStatus: 'PENDING',
    };
  });

  const identityRows = new Map<string, Master4187StagingRow[]>();
  for (const row of rows) {
    const key = `${row.exchange.trim().toUpperCase()}\u001f${row.symbol.trim().toUpperCase()}`;
    const group = identityRows.get(key) ?? [];
    group.push(row);
    identityRows.set(key, group);
  }

  const duplicateGroups: Master4187DuplicateGroup[] = [];
  for (const duplicateRows of identityRows.values()) {
    if (duplicateRows.length < 2) continue;
    const first = duplicateRows[0];
    duplicateGroups.push({
      exchange: first.exchange.trim().toUpperCase(),
      symbol: first.symbol.trim().toUpperCase(),
      sourceRowNumbers: duplicateRows.map((row) => row.sourceRowNumber),
    });
    for (const row of duplicateRows) row.identityStatus = 'QUARANTINED';
  }

  const missingSectorRows = rows.filter((row) => row.sector === null);
  for (const row of missingSectorRows) row.identityStatus = 'QUARANTINED';

  const duplicateSymbolRowCount = duplicateGroups.reduce(
    (sum, group) => sum + group.sourceRowNumbers.length,
    0,
  );

  return {
    rows,
    duplicateGroups,
    missingSectorRows,
    duplicateSymbolRowCount,
    quarantinedRowCount: rows.filter((row) => row.identityStatus === 'QUARANTINED').length,
  };
}
