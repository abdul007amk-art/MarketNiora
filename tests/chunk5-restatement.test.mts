import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCurrentRestatement, validateRestatementChain } from '../backend/src/ebi/restatement.ts';

const base = {
  metric: 'Revenue',
  periodStart: '2026-04-01',
  periodEnd: '2026-06-30',
  reportedDate: '2026-08-01',
};

test('C5-028 valid restatement chain selects the terminal version', () => {
  const versions = [
    { ...base, id: 'R-1', restatementId: 'R-1', supersedesRestatementId: null },
    { ...base, id: 'R-2', restatementId: 'R-2', supersedesRestatementId: 'R-1' },
  ];
  assert.deepEqual(validateRestatementChain(versions), []);
  assert.equal(selectCurrentRestatement(versions)?.id, 'R-2');
});

test('C5-028 missing superseded version is rejected', () => {
  const versions = [
    { ...base, id: 'R-2', restatementId: 'R-2', supersedesRestatementId: 'R-1' },
  ];
  assert.ok(validateRestatementChain(versions).some((x) => x.includes('not found')));
});

test('C5-028 self-supersession is rejected', () => {
  const versions = [
    { ...base, id: 'R-1', restatementId: 'R-1', supersedesRestatementId: 'R-1' },
  ];
  assert.ok(validateRestatementChain(versions).some((x) => x.includes('cannot supersede itself')));
});

test('C5-028 superseded metric/period mismatch is rejected', () => {
  const versions = [
    { ...base, id: 'R-1', restatementId: 'R-1', supersedesRestatementId: null },
    { ...base, id: 'R-2', restatementId: 'R-2', periodEnd: '2026-06-29', supersedesRestatementId: 'R-1' },
  ];
  assert.ok(validateRestatementChain(versions).some((x) => x.includes('metric/period')));
});

test('C5-028 ambiguous terminal versions fail closed', () => {
  const versions = [
    { ...base, id: 'R-1', restatementId: 'R-1', supersedesRestatementId: null },
    { ...base, id: 'R-2', restatementId: 'R-2', supersedesRestatementId: 'R-1' },
    { ...base, id: 'R-3', restatementId: 'R-3', supersedesRestatementId: null },
  ];
  assert.equal(selectCurrentRestatement(versions), null);
});
