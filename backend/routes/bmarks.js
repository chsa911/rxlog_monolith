    // backend/routes/bmarks.js
    const express = require('express');
    const {
      previewBMark,
      registerBook,
      releaseBMark,
    } = require('../controllers/bmarksController');

    const router = express.Router();

    // GET /api/bmarks/preview?prefix=egk
    router.get('/preview', previewBMark);

    // POST /api/bmarks/register   (body contains book fields)
    router.post('/register', registerBook);

    // PATCH /api/bmarks/:id/release
    router.patch('/:id/release', releaseBMark);

    module.exports = router;
