// backend/controllers/booksController.js
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');
const { getStatus, computeRank } = require('../utils/status');
const sizeToPrefixFromDb = require('../utils/sizeToPrefixFromDb');

/**
 * List books with pagination, sort, search, filters
 */
exports.listBooks = async (req, res) => { /* ... as you already have ... */ };

/**
 * Register a new book and assign a free BMark
 */
exports.registerBook = async (req, res) => {
  try {
    const { BBreite, BHoehe, ...fields } = req.body;

    const prefix = await sizeToPrefixFromDb(Number(BBreite), Number(BHoehe));
    if (!prefix) {
      return res.status(400).json({ error: "No matching size rule" });
    }

    const picked = await BMarkf.findOneAndDelete(
      { BMark: new RegExp(`^${prefix}`, "i") },
      { sort: { rank: 1, BMark: 1 }, new: true }
    ).lean();

    if (!picked) {
      return res.status(409).json({ error: "No free BMark for this prefix" });
    }

    const doc = await Book.create({
      BBreite: Number(BBreite),
      BHoehe: Number(BHoehe),
      ...fields,
      BMarkb: picked.BMark,
    });

    res.json({ ...doc.toObject(), status: getStatus(doc) });
  } catch (err) {
    console.error("registerBook error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get a single book by ID
 */
exports.getBook = async (req, res) => {
  const { id } = req.params;
  const book = await Book.findById(id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json({ ...book.toObject(), status: getStatus(book) });
};

/**
 * Autocomplete for BAutor, BKw, BVerlag
 */
exports.autocomplete = async (req, res) => { /* ... as you already have ... */ };

/**
 * Toggle Top
 */
exports.setTop = async (req, res) => { /* ... as you already have ... */ };

/**
 * Set Historisiert / Vorzeitig / Open
 */
exports.setStatus = async (req, res) => { /* ... as you already have ... */ };
