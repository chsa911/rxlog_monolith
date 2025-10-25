// backend/routes/books.js
const express = require('express');
const router = express.Router();

// Import the whole controller object (avoids destructuring undefineds)
const books = require('../controllers/booksController');

// Optional: quick visibility to ensure what we actually have
// console.log('[books routes] exports:', Object.keys(books));

/**
 * Handlers with safe fallbacks (support both new and old names)
 */
const listBooks = books.listBooks;
const getBook = books.getBook;
const registerBook = books.registerBook || books.register; // tolerate legacy "register"
const updateBook = books.updateBook || books.patch || books.update;
const deleteBook = books.deleteBook || books.remove;

// Guard: if any required handler is missing, throw a clear error early
function must(fn, name) {
  if (typeof fn !== 'function') {
    throw new Error(`booksController.${name} is not a function (got ${typeof fn})`);
  }
  return fn;
}

// Routes
router.get('/', must(listBooks, 'listBooks'));
router.get('/:id', must(getBook, 'getBook'));
router.post('/register', must(registerBook, 'registerBook'));
router.patch('/:id', must(updateBook, 'updateBook'));
router.delete('/:id', must(deleteBook, 'deleteBook'));

module.exports = router;

