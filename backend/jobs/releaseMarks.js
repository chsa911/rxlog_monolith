// backend/jobs/releaseMarks.js
const cron = require('node-cron');
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');

async function releaseEligibleMarks({ dryRun = false } = {}) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Eligible: has H or V set, timestamp at least 7 days old, and still holds a mark
  const books = await Book.find({
    BHVorV: { $in: ['H', 'V'] },
    BHVorVAt: { $lte: sevenDaysAgo },
    BMarkb: { $ne: null },
  }).lean();

  let released = 0;

  for (const b of books) {
    const mark = b.BMarkb;
    if (!mark) continue;

    if (dryRun) {
      console.log(`[DRY] would release ${mark} from book ${b._id}`);
      continue;
    }

    // Return mark to free pool (upsert)
    await BMarkf.updateOne(
      { BMark: mark },
      { $setOnInsert: { BMark: mark, rank: 9999 } },
      { upsert: true }
    );

    // Clear the mark from the book so it isn't released twice
    await Book.updateOne(
      { _id: b._id, BMarkb: mark },
      { $set: { BMarkb: null } }
    );

    released++;
  }

  return { scanned: books.length, released };
}

function start() {
  // Run daily at 02:15 Europe/Berlin
  const task = cron.schedule(
    '15 2 * * *',
    () => {
      releaseEligibleMarks().then(
        r => console.log(`[releaseMarks] scanned=${r.scanned} released=${r.released}`),
        e => console.error('[releaseMarks] ERROR', e)
      );
    },
    { timezone: 'Europe/Berlin' }
  );
  console.log('🕑 releaseMarks job scheduled for 02:15 Europe/Berlin daily');
  return { task, runOnce: releaseEligibleMarks };
}

module.exports = { start, runOnce: releaseEligibleMarks };
