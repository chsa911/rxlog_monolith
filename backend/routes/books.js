const express = require("express");
const router = express.Router();
const booksController = require("../controllers/booksController");

// Register a new book
router.post("/register", booksController.registerBook);
router.get("/", booksController.listBooks);
router.patch("/:id", booksController.updateBook);
router.get("/:id", booksController.getBook);
router.delete("/:id", booksController.deleteBook);

module.exports = router;
