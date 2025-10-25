// backend/controllers/booksController.js

const { Types } = require("mongoose");
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
 * Body expects book fields plus a barcode identifier under one of:
 *   - barcode
 *   - code
 *   - BMarkb
 *   - barcodeId
 *
 * Flow:
 *  1) Reserve barcode (by id-or-code), guarding availability.
 *  2) Create book (set barcode/BMarkb to reserved code).
 *  3) Backlink assignedBookId on the barcode; mark as assigned & unavailable.
 *  4) On any failure, roll back the reservation.
 */
async function registerBook(req, res) {
  // Defensive payload cleanup
  stripInvalidId(req.body);

  // Extract a barcode identifier from body
  const suppliedBarcode =
    req.body?.barcode ||
    req.body?.code ||
    req.body?.BMarkb ||
    req.body?.barcodeId;

  if (!suppliedBarcode) {
    return res
      .status(400)
      .json({ error: "Missing barcode (code or id) in body" });
  }

  // Build the book payload while excluding barcode helper fields
  const {
    barcode,
    code,
    BMarkb,
    barcodeId,
    _id, // ignore any client-supplied _id for create
    ...bookPayload
  } = req.body || {};

  let reservedBarcodeDoc = null;
  let created = null;

  try {
    // 1) Reserve the barcode (atomic)
    reservedBarcodeDoc = await Barcode.findOneAndUpdate(
      {
        $and: [
          idOrCodeQuery(suppliedBarcode),
          // Available: either explicit true or no false; and not already assigned/reserved
          { isAvailable: { $ne: false } },
          { status: { $in: ["free", "available"] } },
        ],
      },
      {
        $set: {
          isAvailable: false,
          status: "reserved",
          reservedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!reservedBarcodeDoc) {
      return res
        .status(404)
        .json({ error: "Barcode not found or not available" });
    }

    // Ensure the book stores the chosen barcode code (Book model will sync BMarkb <-> barcode)
    const chosenCode = reservedBarcodeDoc.code;

    // 2) Create the book
    created = await Book.create({
      ...bookPayload,
      barcode: chosenCode,
      BMarkb: bookPayload.BMarkb || chosenCode,
      // BEind is defaulted by the schema; no need to set unless you want explicit dates
    });

    // 3) Backlink on the barcode (robust matcher)
    const backlinkMatch = idOrCodeQuery(
      reservedBarcodeDoc?._id || reservedBarcodeDoc?.code || suppliedBarcode
    );

    await Barcode.updateOne(backlinkMatch, {
      $set: {
        assignedBookId: created._id,
        status: "assigned",
        isAvailable: false,
      },
      $unset: {
        releasedAt: 1,
      },
    });

    return res.status(201).json({
      book: created,
      barcode: {
        _id: reservedBarcodeDoc._id,
        code: reservedBarcodeDoc.code,
        status: "assigned",
      },
    });
  } catch (err) {
    console.error("[registerBook] error:", err);

    // 4) Roll back the barcode reservation if something failed
    try {
      if (reservedBarcodeDoc || suppliedBarcode) {
        const rollbackMatch = idOrCodeQuery(
          reservedBarcodeDoc?._id ||
            reservedBarcodeDoc?.code ||
            suppliedBarcode
        );
        await Barcode.updateOne(rollbackMatch, {
          $set: {
            isAvailable: true,
            status: "available",
            reservedAt: null,
            assignedBookId: null,
          },
          $unset: {
            reservedAt: 1,
          },
        });
      }
    } catch (rbErr) {
      console.error("[registerBook] rollback error:", rbErr);
    }

    return res.status(500).json({ error: "Failed to register book" });
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

    const result = await Book.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!result) return res.status(404).json({ error: "Book not found" });

    // Note: your Book model already frees barcodes on certain statuses after update
    // via a post('findOneAndUpdate') hook. (e.g., "abandoned", "finished")

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
              reservedAt: null,
              assignedBookId: null,
            },
            $unset: {
              reservedAt: 1,
            },
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

module.exports = {
  listBooks,
  getBook,
  registerBook,
  updateBook,
  deleteBook,
};

