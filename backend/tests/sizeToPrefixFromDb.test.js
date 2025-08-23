// backend/tests/sizeToPrefixFromDb.test.js
const mongoose = require('mongoose');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

function pickMiddle(min, max) {
  if (min == null && max == null) return null;
  if (min == null) return max - 0.1;
  if (max == null) return min + 0.1;
  return (min + max) / 2;
}

describe('sizeToPrefixFromDb', () => {
  beforeAll(async () => {
    await mongoose.connect(MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('should match all seeded size rules', async () => {
    const col = mongoose.connection.db.collection('sizerules');
    const rules = await col.find().toArray();

    for (const rule of rules) {
      const w = pickMiddle(rule.minB ?? rule.wMin, rule.maxB ?? rule.wMax);

      for (const band of rule.bands) {
        if (band.condition === 'lt') {
          const h = band.value - 0.1; // slightly below threshold
          const prefix = await sizeToPrefixFromDb(w, h);
          expect(prefix).toBe(band.prefix);
        }
        if (band.condition === 'gt') {
          const h = band.value + 0.1; // slightly above threshold
          const prefix = await sizeToPrefixFromDb(w, h);
          expect(prefix).toBe(band.prefix);
        }
        if (band.condition === 'eq') {
          for (const v of band.values) {
            const prefix = await sizeToPrefixFromDb(w, v);
            expect(prefix).toBe(band.prefix);
          }
        }
      }
    }
  });
});
