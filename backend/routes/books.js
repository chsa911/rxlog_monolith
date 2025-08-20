// backend/routes/books.js
const express = require('express');
const {
  listBooks,
  autocomplete,
  setTop,
  setStatus,
} = require('../controllers/booksController');

const router = express.Router();

// GET /api/books?q=...&page=1&limit=20&sortBy=...&status=...
router.get('/', listBooks);

// GET /api/books/autocomplete/:field?q=...
router.get('/autocomplete/:field', autocomplete);

// Register new book
router.post("/", booksController.registerBook);

// PATCH /api/books/:id/top   { top: true|false }
router.patch('/:id/top', setTop);

// PATCH /api/books/:id/status   { status: 'historisiert'|'vorzeitig'|'open' }
router.patch('/:id/status', setStatus);

module.exports = router;
