// backend/scripts/testSizeToPrefix.js
const mongoose = require('mongoose');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to DB');

  // Define test cases (BBreite, BHoehe, expectedPrefix)
  const tests = [
    [11.5, 17.9, 'eb'],
    [11.5, 19,   'ob'],
    [11.5, 21,   'lb'],
    [10.4, 17.4, 'egk'],
    [10.4, 21,   'lgk'],
    [10.4, 18.5, 'ogk'],
    [12.5, 20,   'ek'],
    [12.5, 21,   'lk'],
  ];

  for (const [w, h, expected] of tests) {
    const prefix = await sizeToPrefixFromDb(w, h);
    console.log(`w=${w}, h=${h} → ${prefix} ${expected ? `(expected ${expected})` : ''}`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
