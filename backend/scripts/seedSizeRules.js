// backend/scripts/seedSizeRules.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

// Reuse model if it already exists to avoid OverwriteModelError
const SizeRule =
  mongoose.models.SizeRule ||
  mongoose.model(
    'SizeRule',
    new mongoose.Schema({
      minB: Number,
      maxB: Number,
      maxBInc: { type: Boolean, default: true },
      bands: [
        {
          condition: { type: String, enum: ['lt', 'eq', 'gt'] },
          value: Number,
          values: [Number],
          prefix: String,
        },
      ],
    })
  );

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Seed connected to DB:', mongoose.connection.db.databaseName);

    // ⚠️ Wipes existing rules — comment out while debugging if you like
    await SizeRule.deleteMany({});
    console.log('🗑️ Cleared old size rules');

    const rules = [
      // ---- Size 0 ----
      {
        minB: null,
        maxB: 10.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 17.5, prefix: 'egk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lgk' },
          { condition: 'gt', value: 17.5, prefix: 'ogk' },
        ],
      },
      // ---- Size 1 ----
      {
        minB: 10.5,
        maxB: 11.3,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 18, prefix: 'eak' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lak' },
          { condition: 'gt', value: 18, prefix: 'oak' },
        ],
      },
      // ---- Size 2 ----
      {
        minB: 11.3,
        maxB: 11.4,
        maxBInc: true,
        bands: [{ condition: 'lt', value: 18, prefix: 'ekb' }],
      },
      // ---- Size 3 ----
      {
        minB: 11.4,
        maxB: 11.8,
        maxBInc: false,
        bands: [
          { condition: 'lt', value: 18, prefix: 'eb' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lb' },
          { condition: 'gt', value: 18, prefix: 'ob' },
        ],
      },
      // ---- Size 4 ----
      {
        minB: 11.8,
        maxB: 11.9,
        maxBInc: true,
        bands: [{ condition: 'lt', value: 19, prefix: 'ekg' }],
      },
      // ---- Size 5 ----
      {
        minB: 11.9,
        maxB: 12.3,
        maxBInc: false,
        bands: [
          { condition: 'lt', value: 18.5, prefix: 'es' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'ls' },
          { condition: 'gt', value: 18.5, prefix: 'os' },
        ],
      },
      // ---- Size 6 ----
      {
        minB: 12.3,
        maxB: 12.4,
        maxBInc: true,
        bands: [{ condition: 'lt', value: 19, prefix: 'eki' }],
      },
      // ---- Size 7 ----
      {
        minB: 12.4,
        maxB: 12.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 19, prefix: 'ei' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'li' },
          { condition: 'gt', value: 19, prefix: 'oi' },
        ],
      },
      // ---- Size 8 ----
      {
        minB: 12.5,
        maxB: 13,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 20, prefix: 'ek' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lk' },
          { condition: 'gt', value: 20, prefix: 'ok' },
        ],
      },
      // ---- Size 9 ----
      {
        minB: 13,
        maxB: 13.4,
        maxBInc: true,
        bands: [{ condition: 'lt', value: 21, prefix: 'ekn' }],
      },
      // ---- Size 10 ----
      {
        minB: 13,
        maxB: 13.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 20.5, prefix: 'en' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'ln' },
          { condition: 'gt', value: 21.5, prefix: 'ogk' },
        ],
      },
      // ---- Size 11 ----
      {
        minB: 13.4,
        maxB: 14,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 20.5, prefix: 'egk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lgk' },
          { condition: 'gt', value: 21.5, prefix: 'ogk' },
        ],
      },
      // ---- Size 12 ----
      {
        minB: 14,
        maxB: 14.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 20.5, prefix: 'ep' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lp' },
          { condition: 'gt', value: 21.5, prefix: 'op' },
        ],
      },
      // ---- Size 13 ----
      {
        minB: 14.5,
        maxB: 15,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 20.5, prefix: 'eg' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lg' },
          { condition: 'gt', value: 21.5, prefix: 'og' },
        ],
      },
      // ---- Size 14 ----
      {
        minB: 15,
        maxB: 15.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 22, prefix: 'epk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lpk' },
          { condition: 'gt', value: 22, prefix: 'opk' },
        ],
      },
      // ---- Size 15 ----
      {
        minB: 15.5,
        maxB: 17.3,
        maxBInc: true,
        bands: [{ condition: 'lt', value: 23, prefix: 'ekt' }],
      },
      // ---- Size 16 ----
      {
        minB: 17.3,
        maxB: 17.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 23, prefix: 'et' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lt' },
          { condition: 'gt', value: 23, prefix: 'ot' },
        ],
      },
      // ---- Size 17 ----
      {
        minB: 17.5,
        maxB: 22.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 23, prefix: 'etk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'ltk' },
          { condition: 'gt', value: 23, prefix: 'otk' },
        ],
      },
      // ---- Size 18 ----
      {
        minB: 22.5,
        maxB: 24,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 28, prefix: 'eu' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lu' },
          { condition: 'gt', value: 28, prefix: 'ou' },
        ],
      },
      // ---- Size 19 ----
      {
        minB: 24,
        maxB: 24.5,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 29, prefix: 'euk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'luk' },
          { condition: 'gt', value: 29, prefix: 'ouk' },
        ],
      },
      // ---- Size 20 ----
      {
        minB: 24.5,
        maxB: 27,
        maxBInc: true,
        bands: [
          { condition: 'lt', value: 32, prefix: 'eyk' },
          { condition: 'eq', values: [20.5, 21, 21.5], prefix: 'lyk' },
          { condition: 'gt', value: 32, prefix: 'oyk' },
        ],
      },
    ];

    const res = await SizeRule.insertMany(rules, { ordered: true });
    console.log(`✅ Inserted ${res.length} size rules`);
  } catch (err) {
    console.error('❌ Error seeding size rules:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

seed();
