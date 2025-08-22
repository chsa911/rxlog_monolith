const express = require('express');
const {
  previewBMark,
  previewBySize,
  prefixBySize,
  diagBySize,
  registerBook,
  releaseBMark,
} = require('../controllers/bmarksController');


const router = express.Router();


router.get('/preview', previewBMark);
router.get('/preview-by-size', previewBySize);
router.get('/prefix-by-size', prefixBySize);
router.get('/diag', diagBySize);

// optional stubs — remove if you use /api/books/register instead
router.post('/register', registerBook);
router.patch('/:id/release', releaseBMark);

module.exports = router;
