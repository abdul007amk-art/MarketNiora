const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const prismaSchema = fs.readFileSync('database/prisma/schema.prisma', 'utf8');
const migration = fs.readFileSync('database/migrations/012_marketniora.sql', 'utf8');

function modelBlock(source, modelName) {
  const start = source.indexOf(`model ${modelName} {`);
  assert.notEqual(start, -1, `missing Prisma model ${modelName}`);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, `unterminated Prisma model ${modelName}`);
  return source.slice(start, end + 2);
}

test('RawStockObservation requires an existing canonical stock in Prisma', () => {
  const model = modelBlock(prismaSchema, 'RawStockObservation');
  assert.match(model, /stockId\s+String\s+@db\.Uuid\s+@map\("stock_id"\)/);
  assert.doesNotMatch(model, /stockId\s+String\?/);
  assert.match(model, /stock\s+CanonicalStock\s+@relation\(fields:\s*\[stockId\]/);
  assert.doesNotMatch(model, /stock\s+CanonicalStock\?/);
});

test('database migration enforces the same raw-observation identity contract', () => {
  assert.match(migration, /ALTER COLUMN stock_id SET NOT NULL/i);
  assert.match(migration, /FOREIGN KEY \(stock_id\)[\s\S]{0,180}REFERENCES production_layer\.canonical_stock/i);
});

test('raw observations cannot be updated or deleted after insertion', () => {
  assert.match(migration, /CREATE TRIGGER raw_observation_immutable[\s\S]{0,180}BEFORE UPDATE OR DELETE/i);
  assert.match(migration, /reject_append_only_mutation/i);
});
