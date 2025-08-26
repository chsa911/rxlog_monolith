
// backend/routes/books.js
const express = require('express');
const router = express.Router();
const books = require('../controllers/booksController');

router.get('/', books.listBooks);
router.post('/register', books.registerBook);
router.get('/autocomplete', books.autocomplete);
router.get('/:id', books.getBook);
router.patch('/:id', books.updateBook);
router.delete('/:id', books.deleteBook);

module.exports = router;
