// backend/routes/books.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/booksController');

// Register a new book
router.post('/register', ctrl.registerBook);

// Autocomplete (place this BEFORE /:id!)
router.get('/autocomplete/:field', ctrl.autocomplete);

// List with filters/pagination
router.get('/', ctrl.listBooks);

// Update (PATCH)
router.patch('/:id', ctrl.updateBook);

// Get single book
router.get('/:id', ctrl.getBook);

// Delete
router.delete('/:id', ctrl.deleteBook);

module.exports = router;
