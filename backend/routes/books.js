// backend/routes/books.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Book = require("../models/Book");           // adjust paths if needed
const Barcode = require("../models/Barcode");
const { freeBarcodes } = require("../utils/freeBarcodes");

const DONE = new Set(["finished", "abandoned"]);
const MAX_LIMIT = 100;

// Helpers
const toId = (v) => new mongoose.Types.ObjectId(String(v));
const norm = (s) => (s == null ? null : String(s).trim());
const pickBarcode = (b) => norm(b?.BMarkb) || norm(b?.barcode);

// ------------------------------------------------------------------
// GET /api/books
// ?page=1&limit=20&sortBy=BEind&order=desc
// ------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(req.query.limit ?? "20", 10)));
    const skip  = (page - 1) * limit;

    const sortBy = req.query.sortBy || req.query.sort || "createdAt";
    const order  = String(req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Book.find({})
        .sort({ [sortBy]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      Book.countDocuments({})
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    console.error("[GET /api/books] error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

// ------------------------------------------------------------------
// GET /api/books/:id
// ------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(toId(req.params.id)).lean();
    if (!book) return res.status(404).json({ error: "not_found" });
    res.json(book);
  } catch (err) {
    console.error("[GET /api/books/:id] error:", err);
    res.status(400).json({ error: "bad_request" });
  }
});

// ------------------------------------------------------------------
// GET /api/books/autocomplete?field=BAutor&q=prefix
// ------------------------------------------------------------------
router.get("/autocomplete", async (req, res) => {
  try {
    const field = String(req.query.field || "").trim();
    const q = String(req.query.q || "").trim();
    if (!field || !q) return res.json([]);

    const rx = new RegExp("^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const rows = await Book.aggregate([
      { $match: { [field]: { $type: "string", $regex: rx } } },
      { $group: { _id: `$${field}` } },
      { $limit: 20 }
    ]);

    res.json(rows.map(r => r._id).filter(Boolean));
  } catch (err) {
    console.error("[GET /api/books/autocomplete] error:", err);
    res.status(200).json([]);
  }
});

// ------------------------------------------------------------------
// POST /api/books/register
// Body: { barcode, ...bookFields }
// - verifies barcode is available
// - marks barcode unavailable
// - creates book with barcode + legacy BMarkb
// ------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { barcode, ...bookRaw } = req.body || {};
    const code = norm(barcode);
    if (!code) return res.status(400).json({ error: "barcode_required" });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const assigned = await Barcode.findOneAndUpdate(
        {
          code: code,
          $or: [
            { isAvailable: true },
            { isAvailable: 1 },
            { isAvailable: "1" },
            { isAvailable: { $exists: false } },
            { status: { $in: ["available", "free"] } }
          ]
        },
        {
          $set: { isAvailable: false, status: "unavailable", assignedAt: new Date() },
          $currentDate: { updatedAt: true }
        },
        { new: true, session, lean: true }
      );
      if (!assigned) {
        const err = new Error("barcode_unavailable");
        err.http = 409; err.payload = { error: "barcode_unavailable" };
        throw err;
      }

      await Book.create([{ ...bookRaw, barcode: code, BMarkb: code }], { session });
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[POST /api/books/register] error:", err);
    res.status(err.http || 500).json(err.payload || { error: "internal_error" });
  }
});

// ------------------------------------------------------------------
// PATCH /api/books/:id
// Body: partial update.
// Behavior:
// - If status transitions to finished/abandoned => free current barcode and unset on book.
// - If barcode changes:
//     * ensure new barcode is available, mark unavailable
//     * free the old barcode (if any)
// - Keeps `barcode` and `BMarkb` in sync.
// ------------------------------------------------------------------
router.patch("/:id", async (req, res) => {
  const id = toId(req.params.id);
  const body = req.body || {};
  const nextStatus = body.status !== undefined ? String(body.status).toLowerCase() : undefined;
  const nextCode   = body.barcode !== undefined ? norm(body.barcode) :
                     body.BMarkb !== undefined ? norm(body.BMarkb) : undefined;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const prev = await Book.findById(id).session(session);
      if (!prev) throw Object.assign(new Error("not_found"), { http: 404 });

      const prevCode = pickBarcode(prev);
      const prevDone = DONE.has(String(prev.status || "").toLowerCase());
      const willBeDone = nextStatus !== undefined ? DONE.has(nextStatus) : prevDone;

      // If barcode is explicitly changing, validate & reserve the new one first
      if (nextCode !== undefined && nextCode !== prevCode) {
        if (!nextCode) {
          // clearing barcode explicitly; free the old one
          if (prevCode) {
            await freeBarcodes([prevCode], id);
          }
        } else {
          // reserve new
          const reserved = await Barcode.findOneAndUpdate(
            { code: nextCode, isAvailable: true },
            { $set: { isAvailable: false, status: "unavailable", assignedAt: new Date(), assignedBookId: id } },
            { new: true, session }
          );
          if (!reserved) {
            const err = new Error("barcode_unavailable");
            err.http = 409; err.payload = { error: "barcode_unavailable" };
            throw err;
          }
          // free old, if any
          if (prevCode) await freeBarcodes([prevCode], id);
        }
      }

      // Apply the book update (keep fields in sync)
      const $set = { ...body };
      if (nextCode !== undefined) { $set.barcode = nextCode; $set.BMarkb = nextCode; }
      const updated = await Book.findByIdAndUpdate(id, { $set }, { new: true, session, runValidators: true });

      // If transitioning to DONE, free whatever code remains and unset both fields
      const curCode = pickBarcode(updated);
      if (!prevDone && willBeDone && curCode) {
        await freeBarcodes([curCode], id);
        await Book.updateOne({ _id: id }, { $unset: { barcode: "", BMarkb: "" } }, { session });
      }

      res.json({ ok: true, item: updated.toObject() });
    });
  } catch (err) {
    console.error("[PATCH /api/books/:id] error:", err);
    res.status(err.http || 500).json(err.payload || { error: err.message || "internal_error" });
  } finally {
    await session.endSession();
  }
});

// ------------------------------------------------------------------
// POST /api/books/:id/status  { status }
// Convenience endpoint to flip status; applies the same auto-free logic.
// ------------------------------------------------------------------
router.post("/:id/status", async (req, res) => {
  const id = toId(req.params.id);
  const status = String(req.body?.status ?? "").toLowerCase();
  if (!status) return res.status(400).json({ error: "status_required" });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const prev = await Book.findById(id).session(session);
      if (!prev) throw Object.assign(new Error("not_found"), { http: 404 });

      const wasDone = DONE.has(String(prev.status || "").toLowerCase());
      const nowDone = DONE.has(status);

      // update status
      await Book.updateOne({ _id: id }, { $set: { status } }, { session });

      if (!wasDone && nowDone) {
        const code = pickBarcode(prev);
        if (code) {
          await freeBarcodes([code], id);
          await Book.updateOne({ _id: id }, { $unset: { barcode: "", BMarkb: "" } }, { session });
        }
      }

      res.json({ ok: true });
    });
  } catch (err) {
    console.error("[POST /api/books/:id/status] error:", err);
    res.status(err.http || 500).json({ error: err.message || "internal_error" });
  } finally {
    await session.endSession();
  }
});

// ------------------------------------------------------------------
// POST /api/books/:id/release-barcode
// Frees whatever barcode is currently on the book and unsets it.
// ------------------------------------------------------------------
router.post("/:id/release-barcode", async (req, res) => {
  const id = toId(req.params.id);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const book = await Book.findById(id).session(session);
      if (!book) throw Object.assign(new Error("not_found"), { http: 404 });

      const code = pickBarcode(book);
      if (!code) return res.json({ ok: true, released: 0 });

      const result = await freeBarcodes([code], id);
      await Book.updateOne({ _id: id }, { $unset: { barcode: "", BMarkb: "" } }, { session });

      res.json({ ok: true, released: result.modified });
    });
  } catch (err) {
    console.error("[POST /api/books/:id/release-barcode] error:", err);
    res.status(err.http || 500).json({ error: err.message || "internal_error" });
  } finally {
    await session.endSession();
  }
});

// ------------------------------------------------------------------
// DELETE /api/books/:id
// Optionally free its barcode before deletion (default: true via ?free=1)
// ------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  const id = toId(req.params.id);
  const alsoFree = String(req.query.free ?? "1") !== "0";

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const book = await Book.findById(id).session(session);
      if (!book) return res.status(404).json({ error: "not_found" });

      const code = pickBarcode(book);
      if (alsoFree && code) await freeBarcodes([code], id);

      await Book.deleteOne({ _id: id }, { session });
      res.json({ ok: true, freed: alsoFree && !!code ? 1 : 0 });
    });
  } catch (err) {
    console.error("[DELETE /api/books/:id] error:", err);
    res.status(500).json({ error: "internal_error" });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
