// backend/routes/bmarks.js
const express = require('express');
const bmarksController = require('../controllers/bmarksController');

const router = express.Router();

// Optional: quick sanity log
console.log('bmarksController has:', Object.keys(bmarksController));
// e.g. should include ['previewBMark','registerBook','releaseBMark','previewBySize','diagBySize']

// Diagnostics (make sure diagBySize is exported in the controller)
router.get('/diag', bmarksController.diagBySize);

// Plain prefix preview (?prefix=egk)
router.get('/preview', bmarksController.previewBMark);

// Size-aware preview (?BBreite=...&BHoehe=...)
router.get('/preview-by-size', bmarksController.previewBySize);

// Register a new book (assigns and consumes a mark)
router.post('/register', bmarksController.registerBook);

// Release mark (if you implemented it)
router.patch('/:id/release', bmarksController.releaseBMark);

module.exports = router;
