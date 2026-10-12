import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { assertNonProdDatabaseAccess, disconnectPrismaClient, getPrismaClient } from '../backend/src/db/prisma.ts';
import {
  EXPECTED_MASTER_4187_ROWS,
  validateMaster4187Csv,
} from '../backend/src/data/master4187Staging.ts';

function getInputPath(): string {
  const argument = process.argv.find((value) => value.startsWith('--input='));
  const inputPath = argument?.slice('--input='.length).trim();
  if (!inputPath) {
    throw new Error('Usage: MARKETNIORA_DB_TARGET=NON_PROD DATABASE_URL=<approved-nonprod-url> node --experimental-strip-types scripts/stageMaster4187.ts --input=/path/to/MASTER_4187.csv');
  }
  return inputPath;
}

function assertImportSafety(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing master staging import when NODE_ENV=production.');
  }
  if (process.env.MARKETNIORA_DB_TARGET !== 'NON_PROD') {
    throw new Error('Refusing master staging import: MARKETNIORA_DB_TARGET must be NON_PROD.');
  }
  // Also verifies DATABASE_URL points only at the approved non-production clone.
  assertNonProdDatabaseAccess();
}

async function main(): Promise<void> {
  assertImportSafety();
  const inputPath = getInputPath();
  const sourceBytes = readFileSync(inputPath);
  const sourceText = sourceBytes.toString('utf8');
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const sourceFileName = basename(inputPath);
  const plan = validateMaster4187Csv(sourceText, EXPECTED_MASTER_4187_ROWS);
  const prisma = getPrismaClient();

  try {
    await prisma.$connect();
    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent imports of the exact same source bytes.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sourceHash}, 0))`;

      const sameHashBatch = await tx.masterImportBatch.findFirst({
        where: { sourceHash },
        orderBy: { createdAt: 'asc' },
      });
      if (sameHashBatch) {
        const priorCount = await tx.master4187Staging.count({
          where: { batchId: sameHashBatch.batchId },
        });
        if (sameHashBatch.status === 'STAGED' && priorCount === EXPECTED_MASTER_4187_ROWS) {
          return {
            batchId: sameHashBatch.batchId,
            alreadyStaged: true,
            batchStatus: sameHashBatch.status,
            stagedRows: priorCount,
            duplicateGroups: plan.duplicateGroups.length,
            duplicateSymbolRows: plan.duplicateSymbolRowCount,
            missingSectorRows: plan.missingSectorRows.length,
            quarantinedRows: plan.quarantinedRowCount,
          };
        }
        throw new Error(
          `The same source hash already exists in batch ${sameHashBatch.batchId} with status ${sameHashBatch.status} and ${priorCount} staged rows. Manual review is required; no rows were changed.`,
        );
      }

      const priorMasterBatch = await tx.masterImportBatch.findFirst({
        where: { sourceName: { contains: 'MASTER_4187' } },
        orderBy: { createdAt: 'asc' },
      });
      if (priorMasterBatch) {
        throw new Error(
          `A prior MASTER_4187 batch (${priorMasterBatch.batchId}) already exists with a different source hash. Refusing to create a second master batch without owner review.`,
        );
      }

      const existingStagingRows = await tx.master4187Staging.count();
      if (existingStagingRows !== 0) {
        throw new Error(
          `Staging table contains ${existingStagingRows} rows before this import. No new batch was created; investigate the existing staging data first.`,
        );
      }

      const batch = await tx.masterImportBatch.create({
        data: {
          sourceName: `${sourceFileName} :: MASTER_4187`,
          sourceHash,
          status: 'STAGED',
          // Deliberately do not set ownerAuthorizedAt.
        },
      });

      const inserted = await tx.master4187Staging.createMany({
        data: plan.rows.map((row) => ({
          batchId: batch.batchId,
          sourceRowNumber: row.sourceRowNumber,
          name: row.name,
          symbol: row.symbol,
          exchange: row.exchange,
          sector: row.sector,
          subSector: row.subSector,
          shariahStatus: row.shariahStatus,
          googleFinanceTicker: row.googleFinanceTicker,
          identityStatus: row.identityStatus,
        })),
      });
      if (inserted.count !== EXPECTED_MASTER_4187_ROWS) {
        throw new Error(
          `Expected to stage ${EXPECTED_MASTER_4187_ROWS} source rows; staged ${inserted.count}. Transaction rolled back.`,
        );
      }

      if (plan.duplicateGroups.length > 0) {
        await tx.identityConflict.createMany({
          data: plan.duplicateGroups.map((group) => ({
            batchId: batch.batchId,
            exchange: group.exchange,
            symbol: group.symbol,
            status: 'OPEN',
            resolutionNote:
              `MASTER_4187 source rows ${group.sourceRowNumbers.join(', ')} share the same exchange+symbol key. All source rows are retained and quarantined; do not choose a canonical identity without evidence and owner decision.`,
          })),
        });
      }

      if (plan.missingSectorRows.length > 0) {
        await tx.classificationReview.createMany({
          data: plan.missingSectorRows.map((row) => ({
            batchId: batch.batchId,
            symbol: row.symbol,
            companyName: row.name,
            issueType: 'MISSING_SECTOR',
            proposedAction:
              `MASTER_4187 source data row ${row.sourceRowNumber} has a blank Sector. Keep the source value missing and require evidence/owner review; do not infer a sector.`,
            status: 'OPEN',
          })),
        });
      }

      await tx.sourceEvidence.create({
        data: {
          batchId: batch.batchId,
          evidenceType: 'OTHER',
          sourceName: `${sourceFileName} :: MASTER_4187 sheet`,
          claim:
            `Staging input SHA-256 ${sourceHash}; source rows ${plan.rows.length}; duplicate exchange+symbol groups ${plan.duplicateGroups.length}; rows in duplicate groups ${plan.duplicateSymbolRowCount}; missing-sector rows ${plan.missingSectorRows.length}; quarantined rows ${plan.quarantinedRowCount}. Raw Shariah labels and Google Finance tickers are preserved as staging fields only. This evidence does not authorize canonical import.`,
          status: 'PROPOSED',
        },
      });

      const stagedRows = await tx.master4187Staging.count({ where: { batchId: batch.batchId } });
      const openConflicts = await tx.identityConflict.count({
        where: { batchId: batch.batchId, status: 'OPEN' },
      });
      const openClassificationReviews = await tx.classificationReview.count({
        where: { batchId: batch.batchId, status: 'OPEN' },
      });
      if (stagedRows !== EXPECTED_MASTER_4187_ROWS ||
          openConflicts !== plan.duplicateGroups.length ||
          openClassificationReviews !== plan.missingSectorRows.length) {
        throw new Error('Post-insert staging verification failed. Transaction rolled back.');
      }

      return {
        batchId: batch.batchId,
        alreadyStaged: false,
        batchStatus: batch.status,
        stagedRows,
        duplicateGroups: plan.duplicateGroups.length,
        duplicateSymbolRows: plan.duplicateSymbolRowCount,
        missingSectorRows: plan.missingSectorRows.length,
        quarantinedRows: plan.quarantinedRowCount,
        openIdentityConflicts: openConflicts,
        openClassificationReviews,
      };
    });

    console.log('MarketNiora MASTER_4187 staging result');
    console.log(JSON.stringify({
      ...result,
      sourceFileName,
      sourceHash,
      ownerAuthorizedAt: null,
      canonicalRowsWritten: 0,
      shariahStatusesWritten: 0,
      liveMarketDataConfigured: false,
    }, null, 2));
    console.log('Import remains STAGED only. Resolve quarantined rows and obtain required owner authorization before canonical import.');
  } finally {
    await disconnectPrismaClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown staging import failure.';
  console.error('MASTER_4187 staging failed: ' + message);
  process.exitCode = 1;
});
