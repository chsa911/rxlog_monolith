// backend/server.js
// backend/server.js
require('dotenv').config({ path: '../.env' });  // look one level up (project root)
const mongoose = require('mongoose');
const app = require('./app');

const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';
console.log('[env] MONGO_URI =', process.env.MONGO_URI);

// optional daily job — guard in case the file is missing during refactor
let startReleaseJob = null;
try {
  ({ start: startReleaseJob } = require('./jobs/releaseMarks'));
} catch (_) {
  // ignore if the job module doesn't exist yet
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    if (typeof startReleaseJob === 'function') {
      startReleaseJob();
    }

    app.listen(PORT, () => {
      console.log(`🚀 API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Mongo connection error:', err);
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(0);
});
