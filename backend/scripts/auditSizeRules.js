const mongoose = require('mongoose');
require('dotenv').config();
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

(async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const gaps = [];
  const round1 = x => Math.round(x * 10) / 10;

  for (let w = 10.0; w <= 27.0 + 1e-9; w = round1(w + 0.1)) {
    for (let h = 17.0; h <= 32.0 + 1e-9; h = round1(h + 0.5)) {
      const p = await sizeToPrefixFromDb(w, h);
      if (!p) gaps.push(`${w.toFixed(1)}×${h.toFixed(1)}`);
    }
  }

  if (gaps.length) {
    console.log(`❌ ${gaps.length} uncovered combos:`);
    gaps.slice(0, 200).forEach(s => console.log('  ', s));
    if (gaps.length > 200) console.log('  ...(truncated)');
  } else {
    console.log('🎉 No gaps found in the tested grid.');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
})().catch(e => { console.error(e); process.exit(1); });
