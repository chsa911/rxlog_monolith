// backend/controllers/booksController.js
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');
const { getStatus, computeRank } = require('../utils/status');

// IMPORTANT: destructure the function from the util module
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

/* ------------------------- helpers ------------------------- */

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    // Coerce numbers if provided
    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe  != null) body.BHoehe  = toNum(body.BHoehe);

    // Timestamps for Top
    if (typeof body.BTop === 'boolean') {
      body.BTopAt = body.BTop ? new Date() : null;
    }

    // Timestamp for H/V — only if provided
    if (body.BHVorV === 'H' || body.BHVorV === 'V') {
      body.BHVorVAt = new Date();
    }

    const updated = await Book.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ error: 'Book not found' });
    res.json({ ...updated.toObject(), status: getStatus(updated) });
  } catch (err) {
    console.error('updateBook error:', err);
    res.status(400).json({ error: err.message || 'Bad request' });
  }
};

/* ------------------------- list books ------------------------- */
/**
 * GET /api/books
 * Query:
 *   q            - text search across BTitel, BAutor, BVerlag, BKw
 *   page         - page number (1-based)
 *   limit        - items per page (default 20)
 *   sort         - field to sort by (default: createdAt)
 *   order        - asc|desc (default: desc)
 *   historisiert - true|false (optional filter)
 */
exports.listBooks = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
      historisiert,
    } = req.query;

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;
    const direction = order === 'asc' ? 1 : -1;

    const filter = {};
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { BTitel: rx },
        { BAutor: rx },
        { BVerlag: rx },
        { BKw: rx },
        { BMarkb: rx },
      ];
    }
    if (typeof historisiert !== 'undefined') {
      filter.historisiert = String(historisiert).toLowerCase() === 'true';
    }

    const [items, total] = await Promise.all([
      Book.find(filter).sort({ [sort]: direction, _id: -1 }).skip(skip).limit(lim).lean(),
      Book.countDocuments(filter),
    ]);

    const data = items.map((b) => ({ ...b, status: getStatus(b) }));
    res.json({
      data,
      page: pg,
      limit: lim,
      total,
      pages: Math.ceil(total / lim),
    });
  } catch (err) {
    console.error('listBooks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/* ------------------------- register book ------------------------- */
/**
 * POST /api/books/register
 * Body: { BBreite, BHoehe, ...fields }
 * - BBreite, BHoehe are in CM (strings with comma or dot ok)
 * Flow:
 *  1) map (w,h) -> prefix via SizeRule (equals-first)
 *  2) consume next free mark from BMarkf by ^prefix (sort BMark:1, rank:1)
 *  3) if none and prefix ends with 'i', try prefix+'k' (fallback i→ik)
 *  4) create Book with BMarkb
 */
exports.registerBook = async (req, res) => {
  try {
    const { BBreite, BHoehe, ...fields } = req.body;
    const w = toNum(BBreite);
    const h = toNum(BHoehe);

    if (w === null || h === null) {
      return res.status(400).json({ error: 'BBreite and BHoehe (cm) are required' });
    }

    const prefix = await sizeToPrefixFromDb(w, h);
    if (!prefix) {
      return res.status(400).json({ error: 'No matching size rule' });
    }

    // 1st attempt: exact prefix
    let picked = await BMarkf.findOneAndDelete(
      { BMark: new RegExp(`^${prefix}`, 'i') },
      { sort: { BMark: 1, rank: 1 } }
    ).lean();

    // fallback: if prefix ends with 'i', try 'ik'
    if (!picked && /i$/i.test(prefix)) {
      const alt = `${prefix}k`;
      picked = await BMarkf.findOneAndDelete(
        { BMark: new RegExp(`^${alt}`, 'i') },
        { sort: { BMark: 1, rank: 1 } }
      ).lean();
    }

    if (!picked) {
      return res.status(409).json({ error: `No free BMark for prefix ${prefix}` });
    }

    const doc = await Book.create({
      BBreite: w,
      BHoehe: h,
      ...fields,
      BMarkb: picked.BMark,
    });

    res.json({ ...doc.toObject(), status: getStatus(doc) });
  } catch (err) {
    console.error('registerBook error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/* ------------------------- get one ------------------------- */
/**
 * GET /api/books/:id
 */
exports.getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ ...book.toObject(), status: getStatus(book) });
  } catch (err) {
    console.error('getBook error:', err);
    res.status(400).json({ error: 'Bad request' });
  }
};

/* ------------------------- patch/update ------------------------- */
/**
 * PATCH /api/books/:id
 * - Partial update. Coerces BBreite/BHoehe to numbers if present.
 * - Optionally recomputes rank via computeRank() if available.
 */
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;

    const body = { ...req.body };
    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe != null) body.BHoehe = toNum(body.BHoehe);

    const updated = await Book.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ error: 'Book not found' });

    try {
      if (typeof computeRank === 'function') {
        const newRank = computeRank(updated);
        if (typeof newRank === 'number' && newRank !== updated.rank) {
          updated.rank = newRank;
          await updated.save();
        }
      }
    } catch (e) {
      // non-fatal
    }

    res.json({ ...updated.toObject(), status: getStatus(updated) });
  } catch (err) {
    console.error('updateBook error:', err);
    res.status(400).json({ error: err.message || 'Bad request' });
  }
};

/* ------------------------- delete ------------------------- */
/**
 * DELETE /api/books/:id
 * - Deletes book
 * - Returns BMarkb to free pool (upsert with default rank)
 */
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const mark = book.BMarkb;

    await Book.findByIdAndDelete(id);

    if (mark) {
      // return mark to pool; set a conservative default rank high value if new
      await BMarkf.updateOne(
        { BMark: mark },
        { $setOnInsert: { BMark: mark, rank: 9999 } },
        { upsert: true }
      );
    }

    res.json({ ok: true, deletedId: id, releasedBMark: mark || null });
  } catch (err) {
    console.error('deleteBook error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/* ------------------------- optional: autocomplete ------------------------- */
/**
 * GET /api/books/autocomplete?field=BAutor&q=king
 * Supports: BAutor, BKw, BVerlag (extend as needed)
 */
exports.autocomplete = async (req, res) => {
  try {
    const { field, q } = req.query;
    const ALLOWED = new Set(['BAutor', 'BKw', 'BVerlag']);
    if (!ALLOWED.has(field)) return res.status(400).json({ error: 'Invalid field' });
    if (!q || String(q).trim().length < 1) return res.json([]);

    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const docs = await Book.aggregate([
      { $match: { [field]: rx } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 },
    ]);

    res.json(docs.map(d => d._id).filter(Boolean));
  } catch (err) {
    console.error('autocomplete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
