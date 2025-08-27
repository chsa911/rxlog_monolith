// backend/tests/testReleaseMarks.js
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');
const { runOnce } = require('../jobs/releaseMarks');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to DB');

    // 1. Seed a test book with an old BHVorV
    const mark = 'test001';
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    // Ensure mark not in free pool initially
    await BMarkf.deleteOne({ BMark: mark });

    const book = await Book.create({
      BBreite: 11.1,
      BHoehe: 18.1,
      BAutor: 'ReleaseJob Tester',
      BKw: 'Dummy',
      BKP: 1,
      BVerlag: 'Test',
      BSeiten: 111,
      BEind: new Date(),
      BHVorV: 'H',
      BHVorVAt: eightDaysAgo,
      BTop: false,
      BMarkb: mark,
    });

    console.log('📚 Created test book:', book._id.toString(), book.BMarkb);

    // 2. Run release job once
    const result = await runOnce();
    console.log('🌀 Job result:', result);

    // 3. Reload book and check
    const updatedBook = await Book.findById(book._id).lean();
    const releasedMark = await BMarkf.findOne({ BMark: mark }).lean();

    console.log('📕 Book after job:', {
      BMarkb: updatedBook?.BMarkb,
      BHVorV: updatedBook?.BHorV,
      BHVorVAt: updatedBook?.BHVorVAt,
    });

    console.log('📦 Mark pool entry:', releasedMark);

    if (!updatedBook?.BMarkb && releasedMark) {
      console.log('✅ Test PASSED: mark released successfully');
    } else {
      console.error('❌ Test FAILED: mark not released correctly');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
