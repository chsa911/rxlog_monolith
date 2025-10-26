// backend/routes/books.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

/* ---- Model (use existing if present; else fallback to loose model) ---- */
let Book;
try {
  Book = require("../models/Book"); // if you already have a schema, this will be used
} catch {
  // fallback: strict:false so any shape works; uses 'books' collection explicitly
  const Loose = new mongoose.Schema({}, { strict: false, timestamps: false });
  Book = mongoose.models.Book || mongoose.model("Book", Loose, "books");
}

/* ---- helpers ---- */
function toInt(v, def) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function sortDir(order) {
  return String(order).toLowerCase() === "asc" ? 1 : -1;
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---- GET /api/books  (list + search) ----
   Query:
     - page, limit, sortBy, order
     - q | search | term | s  (search term)
   Search fields:
     Titel, BAutor, BVerlag, BKw, barcode, BMark, BMarkb
----------------------------------------------------------------------- */
router.get("/", async (req, res, next) => {
  try {
    const page  = toInt(req.query.page, 1);
    const limit = toInt(req.query.limit, 20);
    const sortBy = req.query.sortBy || req.query.sort || "BEind";
    const order = req.query.order || req.query.direction || "desc";

    const termRaw =
      (req.query.q ??
       req.query.search ??
       req.query.term ??
       req.query.s ??
       "").toString().trim();

    const query = {};
    if (termRaw) {
      const rx = new RegExp(escapeRegex(termRaw), "i"); // substring, case-insensitive
      query.$or = [
        { Titel: rx },
        { BAutor: rx },
        { BVerlag: rx },
        { BKw: rx },
        { barcode: rx },
        { BMark: rx },
        { BMarkb: rx },
      ];
    }

    const sort = { [sortBy]: sortDir(order) };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Book.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Book.countDocuments(query),
    ]);

    res.set("Cache-Control", "no-store"); // avoid 304s in dev
    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
});

/* ---- (optional) simple autocomplete ----
   GET /api/books/autocomplete?field=BAutor&q=har
----------------------------------------------------------------------- */
router.get("/autocomplete", async (req, res, next) => {
  try {
    const field = String(req.query.field || "").trim();
    const q = String(req.query.q || "").trim();
    if (!field || !q) return res.json([]);

    const rx = new RegExp("^" + escapeRegex(q), "i");
    const pipeline = [
      { $match: { [field]: rx } },
      { $group: { _id: "$" + field } },
      { $project: { value: "$_id", _id: 0 } },
      { $limit: 20 },
    ];

    const col = Book.collection;
    const rows = await col.aggregate(pipeline).toArray();
    res.set("Cache-Control", "no-store");
    return res.json(rows.map((r) => r.value).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
