const express = require("express");
const router = express.Router();
const booksController = require("../controllers/booksController");

// specific routes FIRST
router.get("/autocomplete", booksController.autocomplete);          // <-- place before /:id
router.post("/register", booksController.registerBook);
router.get("/", booksController.listBooks);

// routes with :id AFTER all specific ones
router.patch("/:id", booksController.updateBook);
router.get("/:id", booksController.getBook);
router.delete("/:id", booksController.deleteBook);

module.exports = router;
