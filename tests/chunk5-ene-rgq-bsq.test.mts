import test from 'node:test';
import assert from 'node:assert/strict';
import { acceleration, normalGrowth } from '../backend/src/ebi/ene.ts';
import { revenueGrowth } from '../backend/src/ebi/rgq.ts';
import { debtToEquity, netDebt } from '../backend/src/ebi/bsq.ts';

test('ENE acceleration is current growth minus previous growth in percentage points',()=>{
  assert.equal(acceleration(12,5).value,7);
});

test('ENE negative-base and turnaround states are explicit',()=>{
  assert.equal(normalGrowth(-5,-10).state,'NOT_COMPARABLE');
  assert.equal(normalGrowth(5,-10).state,'TURNAROUND_EVENT');
});

test('RGQ does not fabricate volume/realisation support',()=>{
  assert.equal(revenueGrowth(110,100).value,10);
  assert.equal(revenueGrowth(110,0).state,'NOT_COMPUTABLE');
  assert.equal(revenueGrowth(110,-100).state,'NOT_COMPARABLE');
});

test('BSQ zero equity blocks D/E and missing cash blocks net debt',()=>{
  assert.equal(debtToEquity(100,0).state,'NOT_COMPUTABLE');
  assert.equal(netDebt(100,null).state,'NOT_COMPUTABLE');
});
