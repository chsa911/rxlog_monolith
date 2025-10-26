// backend/controllers/booksController.js

const mongoose = require("mongoose");
const { Types } = mongoose;
const Book = require("../models/Book");
const Barcode = require("../models/Barcode");

/**
 * -------- Helpers --------
 */

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function idOrCodeQuery(v) {
  const s = String(v || "").trim();
  return Types.ObjectId.isValid(s)
    ? { _id: s }
    : { code: new RegExp(`^${escapeRx(s)}$`, "i") };
}

// remove invalid _id values from arbitrary payloads to prevent CastErrors
function stripInvalidId(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if ("_id" in obj) {
    const s = String(obj._id || "");
    if (!Types.ObjectId.isValid(s)) {
      delete obj._id;
    }
  }
  return obj;
}

const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const normalizeOrder = (o) => (String(o).toLowerCase() === "asc" ? 1 : -1);

// Whitelist Book fields that are safe to sort by (aligns with your schema)
const SORT_WHITELIST = new Set([
  "BEind",
  "BAutor",
  "BVerlag",
  "BSeiten",
  "BTopAt",
  "BHVorVAt",
  "_id",
]);

function resolveSort(sortByRaw, orderRaw) {
  const sortBy = String(sortByRaw || "").trim();
  const order = normalizeOrder(orderRaw);
  const key = SORT_WHITELIST.has(sortBy) ? sortBy : "BEind";
  return { [key]: order };
}

// Central "free" definition for barcodes (used everywhere)
const FREE_FILTER_BASE = {
  isAvailable: true,
  status: { $in: ["free", "available"] },
  assignedBookId: { $exists: false },
};

/**
 * -------- Controllers --------
 */

/**
 * GET /api/books
 * Query: { page=1, limit=20, sortBy, order, q? }
 */
async function listBooks(req, res) {
  try {
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const sort = resolveSort(req.query.sortBy, req.query.order);

    // Optional text filter
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(escapeRx(q), "i");
      // Cover common searchable fields from your Book model
      filter.$or = [
        { BAutor: rx },
        { BVerlag: rx },
        { BKw: rx },
        { BKw1: rx },
        { BKw2: rx },
        { BMarkb: rx },
        { barcode: rx },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Book.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Book.countDocuments(filter),
    ]);

    res.json({
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        sort,
      },
    });
  } catch (err) {
    console.error("[listBooks] error:", err);
    res.status(500).json({ error: "Failed to list books" });
  }
}

/**
 * GET /api/books/:id
 */
async function getBook(req, res) {
  try {
    const id = String(req.params.id || "");
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book id" });
    }
    const doc = await Book.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Book not found" });
    res.json(doc);
  } catch (err) {
    console.error("[getBook] error:", err);
    res.status(500).json({ error: "Failed to get book" });
  }
}

/**
 * POST /api/books/register
 *
 * Auto-picks an existing, available barcode from the barcodes collection (never generates).
 * Request body:
 *  - sizeRange: string (required)     e.g., "S-30-40"
 *  - prefix?:   string (optional)     e.g., "ep" to restrict series
 *  - ...any other Book fields (title, author, etc.)
 *
 * Flow (transactional):
 *  1) Reserve a real, available barcode that matches { sizeRange, prefix? }.
 *  2) Create the book using the reserved barcode.
 *  3) Mark the barcode as assigned to the created book.
 *
 * On no availability, returns:
 *   404 { error: "no barcodes for this sizeRange available" }
 */
async function registerBook(req, res) {
  // Disallow client-provided barcode identifiers — server chooses from DB only
  const { sizeRange, prefix, ...bookPayloadRaw } = req.body || {};

  if (!sizeRange) {
    return res.status(400).json({ error: "sizeRange is required" });
  }

  // Defensive payload cleanup
  stripInvalidId(bookPayloadRaw);
  const bookPayload = { ...bookPayloadRaw };
  delete bookPayload.barcode;
  delete bookPayload.code;
  delete bookPayload.BMarkb;
  delete bookPayload.barcodeId;
  delete bookPayload._id;

  const session = await Book.startSession();

  try {
    let responsePayload;

    await session.withTransaction(async () => {
      // 1) Reserve a real, available barcode
      const reserveFilter = {
        ...FREE_FILTER_BASE,
        sizeRange,
        ...(prefix ? { code: new RegExp(`^${escapeRx(prefix)}`, "i") } : {}),
      };

      const reserved = await Barcode.findOneAndUpdate(
        reserveFilter,
        {
          $set: { isAvailable: false, status: "reserved", reservedAt: new Date() },
          $currentDate: { updatedAt: true },
        },
        { new: true, sort: { code: 1 }, session }
      ).lean();

      if (!reserved) {
        throw new Error("no barcodes for this sizeRange available");
      }

      const chosenCode = reserved.code;
      const now = new Date();

      // 2) Create the book with that barcode
      const createdArr = await Book.create(
        [
          {
            ...bookPayload,
            barcode: chosenCode,
            BMarkb: bookPayload.BMarkb || chosenCode,
            sizeRange, // keep for convenience/queries
            createdAt: now,
            updatedAt: now,
          },
        ],
        { session }
      );
      const created = createdArr[0];

      // 3) Assign barcode to this book (reserved -> assigned)
      const assigned = await Barcode.findOneAndUpdate(
        {
          _id: reserved._id,
          isAvailable: false,
          status: "reserved",
          assignedBookId: { $exists: false },
        },
        {
          $set: { status: "assigned", assignedBookId: created._id },
          $currentDate: { updatedAt: true },
          $unset: { releasedAt: 1 },
        },
        { new: true, session }
      ).lean();

      if (!assigned) {
        throw new Error("Failed to assign barcode (concurrency).");
      }

      responsePayload = {
        book: created.toObject ? created.toObject() : created,
        barcode: { _id: assigned._id, code: assigned.code, status: assigned.status },
      };
    });

    return res.status(201).json(responsePayload);
  } catch (err) {
    if (err.message === "no barcodes for this sizeRange available") {
      return res.status(404).json({ error: "no barcodes for this sizeRange available" });
    }
    console.error("[registerBook] error:", err);
    return res.status(500).json({ error: "Failed to register book" });
  } finally {
    session.endSession();
  }
}

/**
 * PATCH /api/books/:id
 */
async function updateBook(req, res) {
  try {
    const id = String(req.params.id || "");
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book id" });
    }

    // Prevent invalid _id from causing cast errors
    stripInvalidId(req.body);

    const update = { ...req.body };
    // Never allow client to change these directly
    delete update._id;
    delete update.barcodeId; // keep barcode linkage controlled by server logic

    const result = await Book.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!result) return res.status(404).json({ error: "Book not found" });

    // Note: if you have hooks that free barcodes based on status changes,
    // they will continue to run as before.

    res.json(result);
  } catch (err) {
    console.error("[updateBook] error:", err);
    res.status(500).json({ error: "Failed to update book" });
  }
}

/**
 * DELETE /api/books/:id
 * Also clears assignedBookId on the linked Barcode(s), if any.
 */
async function deleteBook(req, res) {
  try {
    const id = String(req.params.id || "");
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid book id" });
    }

    // Find the book first (to inspect BMarkb/barcode)
    const book = await Book.findById(id).lean();
    if (!book) return res.status(404).json({ error: "Book not found" });

    const codes = [book.BMarkb, book.barcode].filter(Boolean);

    if (codes.length) {
      try {
        // Free any barcodes pointing to this book + codes
        await Barcode.updateMany(
          { code: { $in: codes }, assignedBookId: id },
          {
            $set: {
              isAvailable: true,
              status: "available",
              assignedBookId: null,
            },
            $unset: { reservedAt: 1 },
            $currentDate: { updatedAt: true },
          }
        );
      } catch (linkErr) {
        console.error("[deleteBook] unlink barcode error:", linkErr);
        // Not fatal to deletion
      }
    }

    await Book.deleteOne({ _id: id });

    res.status(204).end();
  } catch (err) {
    console.error("[deleteBook] error:", err);
    res.status(500).json({ error: "Failed to delete book" });
  }
}

/**
 * (Optional) HEAD /api/books/barcodes/available?sizeRange=S-30-40&prefix=ep
 * Lets the UI quickly check availability and show a friendly message before submitting.
 */
async function headAvailable(req, res) {
  try {
    const { sizeRange, prefix } = req.query || {};
    if (!sizeRange) return res.sendStatus(400);

    const filter = {
      ...FREE_FILTER_BASE,
      sizeRange,
      ...(prefix ? { code: new RegExp(`^${escapeRx(prefix)}`, "i") } : {}),
    };

    const exists = await Barcode.findOne(filter).select({ _id: 1 }).lean();
    return res.sendStatus(exists ? 200 : 404);
  } catch (err) {
    console.error("[headAvailable] error:", err);
    return res.sendStatus(500);
  }
}

module.exports = {
  listBooks,
  getBook,
  registerBook,
  updateBook,
  deleteBook,
  headAvailable, // optional convenience endpoint
};

