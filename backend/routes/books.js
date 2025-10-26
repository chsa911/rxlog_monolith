// backend/routes/books.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Book = require("../models/Book");         // adjust path if different
const Barcode = require("../models/Barcode");   // adjust path if different

/* ------------------------- GET /api/books -------------------------
   Query: ?page=1&limit=20&sortBy=BEind&order=desc
-------------------------------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit ?? "20", 10)));
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

/* ---------------------- GET /api/books/autocomplete ----------------------
   Query: ?field=BAutor|BKw|BVerlag|... & q=prefix
   Returns an array of distinct values (max 20) starting with q (case-insensitive)
------------------------------------------------------------------------*/
router.get("/autocomplete", async (req, res) => {
  try {
    const field = String(req.query.field || "").trim();
    const q = String(req.query.q || "").trim();
    if (!field || !q) return res.json([]);

    // case-insensitive prefix match
    const rx = new RegExp("^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // pipeline to get distinct top suggestions
    const rows = await Book.aggregate([
      { $match: { [field]: { $type: "string", $regex: rx } } },
      { $group: { _id: `$${field}` } },
      { $limit: 20 }
    ]);

    res.json(rows.map(r => r._id).filter(Boolean));
  } catch (err) {
    console.error("[GET /api/books/autocomplete] error:", err);
    res.status(200).json([]); // non-fatal for the UI
  }
});

/* ---------------------- POST /api/books/register ----------------------
   Expects: { barcode, ...other book fields... }
   Behavior:
   - Accept the user-chosen barcode if it is still available.
   - Mark barcode unavailable.
   - Create the book with that barcode.
   - No sizeRange, no width/height checks here.
------------------------------------------------------------------------*/
router.post("/register", async (req, res) => {
  try {
    const { barcode, ...bookRaw } = req.body || {};
    if (!barcode) {
      return res.status(400).json({ error: "barcode_required" });
    }

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Assign this exact barcode only if it's available
      const assigned = await Barcode.findOneAndUpdate(
        { code: barcode, $or: [
          { isAvailable: true },
          { isAvailable: 1 },
          { isAvailable: "1" },
          { isAvailable: "true" },
          { isAvailable: { $exists: false } }, // tolerate legacy/missing
          { status: { $in: ["available", "free"] } }
        ] },
        {
          $set: { isAvailable: false, assignedAt: new Date(), status: "unavailable" },
          $currentDate: { updatedAt: true }
        },
        { new: true, session }
      ).lean();

      if (!assigned) {
        const err = new Error("barcode_unavailable");
        err.http = 409;
        err.payload = { error: "barcode_unavailable" };
        throw err;
      }

      // Create the book; keep compatibility fields if your UI reads them
      await Book.create(
        [
          {
            ...bookRaw,
            barcode,        // primary
            BMarkb: barcode // legacy alias used elsewhere in app
          }
        ],
        { session }
      );
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    const status = err.http || 500;
    return res
      .status(status)
      .json(err.payload || { error: err.message || "internal_error" });
  }
});

module.exports = router;
