// backend/routes/books.js
const express = require("express");
const router = express.Router();
const booksController = require("../controllers/booksController");

// Register a new book (assigns next free BMark)
router.post("/register", booksController.registerBook);

// List all books with optional filtering, search, pagination
router.get("/", booksController.listBooks);

// Update book status (e.g. historisiert, v, toptitel, etc.)
router.patch("/:id", booksController.updateBook);

// Get single book by id
router.get("/:id", booksController.getBook);

// Delete a book (optional, only if you want)
router.delete("/:id", booksController.deleteBook);

module.exports = router;
