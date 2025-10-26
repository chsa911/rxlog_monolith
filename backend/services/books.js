// services/books.js
const mongoose = require("mongoose");
const Book = require("../models/Book");
const { freeBarcodes } = require("../utils/freeBarcodes");

const DONE = new Set(["finished", "abandoned"]);
const BARCODE_FIELDS = ["BMarkb", "barcode"];

/**
 * Update a book's status; if it transitions to finished/abandoned,
 * free its barcode and unset it on the book - atomically.
 */
async function updateBookStatus(bookId, newStatus) {
  const session = await mongoose.startSession();
  try {
    let result = { modified: 0, freed: 0 };
    await session.withTransaction(async () => {
      // Load current state (inside txn)
      const book = await Book.findById(bookId, BARCODE_FIELDS.concat("status").join(" ")).session(session);
      if (!book) throw new Error("Book not found");

      const prevStatus = String(book.status || "").toLowerCase();
      const nextStatus = String(newStatus || "").toLowerCase();

      // Always set the new status
      await Book.updateOne({ _id: bookId }, { $set: { status: newStatus } }, { session });

      // Only act on transition into a DONE state
      if (!DONE.has(nextStatus) || DONE.has(prevStatus)) return;

      // Pick whichever barcode field is present
      const code = BARCODE_FIELDS.map(f => book[f]).find(Boolean);
      if (!code) return;

      // 1) Free the barcode, constrained to this book for safety
      const { modified } = await freeBarcodes([String(code).trim()], bookId);

      // 2) Unset the barcode field(s) on the book
      const unsetSpec = BARCODE_FIELDS.reduce((u, f) => (u[f] = "", u), {});
      const ures = await Book.updateOne({ _id: bookId }, { $unset: unsetSpec }, { session });

      result = { modified: ures.modifiedCount || 0, freed: modified || 0 };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { updateBookStatus };
