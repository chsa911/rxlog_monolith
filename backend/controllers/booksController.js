// backend/controllers/booksController.js
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');
const { getStatus, computeRank } = require('../utils/status');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const sevenDaysFromNow = () => new Date(Date.now() + MS_7_DAYS);

/* ------------------------- helpers ------------------------- */
function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------- LIST -------------------------
// GET /api/books
// Query: q, page, limit, sort, order, createdFrom, createdTo
exports.listBooks = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sort = 'BEind',
      order = 'desc',
      createdFrom,
      createdTo,
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
      ...(Number.isFinite(num) ? [{ BSeiten: num }] : []),
      ];
    }

    if (createdFrom || createdTo) {
      filter.BEind = {};
      if (createdFrom) filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
      if (createdTo)   filter.BEind.$lt  = new Date(createdTo   + 'T23:59:59.999Z');
    }

    const [items, total] = await Promise.all([
      Book.find(filter).sort({ [sort]: direction, _id: -1 }).skip(skip).limit(lim).lean(),
      Book.countDocuments(filter),
    ]);

    const data = items.map((b) => ({ ...b, status: getStatus(b) }));
    res.json({ data, page: pg, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (err) {
    console.error('listBooks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
*/
/* ------------------------- LIST -------------------------
exports.listBooks = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sort = 'BEind',
      order = 'desc',
      createdFrom,
      createdTo,
    } = req.query;

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;
    const direction = order === 'asc' ? 1 : -1;

    const filter = {};

    if (q) {
      const cleaned = String(q).trim();
      const num = Number(cleaned);

      if (Number.isFinite(num)) {
        // purely numeric search → only match page count
        filter.BSeiten = num;
      } else {
        // text search → match across these fields
        const rx = new RegExp(
          cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );
        filter.$or = [
          { BTitel: rx },
          { BAutor: rx },
          { BVerlag: rx },
          { BKw: rx },
          { BMarkb: rx },
        ];
      }
    }

    if (createdFrom || createdTo) {
      filter.BEind = {};
      if (createdFrom)
        filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
      if (createdTo)
        filter.BEind.$lt = new Date(createdTo + 'T23:59:59.999Z');
    }

    const [items, total] = await Promise.all([
      Book.find(filter)
        .sort({ [sort]: direction, _id: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
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
*/
/* ------------------------- LIST -------------------------
exports.listBooks = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sort = 'BEind',
      order = 'desc',
      createdFrom,
      createdTo,
    } = req.query;

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;
    const direction = order === 'asc' ? 1 : -1;

    const filter = {};

    if (q) {
      // When q is present → ignore date filters
      const cleaned = String(q).trim();
      const num = Number(cleaned);

      if (Number.isFinite(num)) {
        // purely numeric → search only pages
        filter.BSeiten = num;
      } else {
        const rx = new RegExp(
          cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );
        filter.$or = [
          { BTitel: rx },
          { BAutor: rx },
          { BVerlag: rx },
          { BKw: rx },
          { BMarkb: rx },
        ];
      }
    } else {
      // Only apply date filter if q is empty
      if (createdFrom || createdTo) {
        filter.BEind = {};
        if (createdFrom)
          filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
        if (createdTo)
          filter.BEind.$lt = new Date(createdTo + 'T23:59:59.999Z');
      }
    }

    console.log('listBooks filter:', JSON.stringify(filter, null, 2));

    const [items, total] = await Promise.all([
      Book.find(filter)
        .sort({ [sort]: direction, _id: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
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
};*/
/* ------------------------- LIST ------------------------- */
// GET /api/books
// Query: q, page, limit, sort/sortBy, order, createdFrom, createdTo
exports.listBooks = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sort,
      sortBy,
      order = 'desc',
      createdFrom,
      createdTo,
    } = req.query;

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;
    const direction = order === 'asc' ? 1 : -1;

    // ✅ support both ?sort= and ?sortBy=
    const sortField = sortBy || sort || 'BEind';

    const filter = {};

    if (q) {
      const cleaned = String(q).trim();
      const num = Number(cleaned);

      if (Number.isFinite(num)) {
        // purely numeric query -> interpret as page count
        filter.BSeiten = num;
      } else {
        const rx = new RegExp(
          cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );
        filter.$or = [
          { BTitel: rx },
          { BAutor: rx },
          { BVerlag: rx },
          { BKw: rx },
          { BMarkb: rx },
        ];
      }
    } else {
      if (createdFrom || createdTo) {
        filter.BEind = {};
        if (createdFrom)
          filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
        if (createdTo)
          filter.BEind.$lt = new Date(createdTo + 'T23:59:59.999Z');
      }
    }

    console.log('listBooks filter:', JSON.stringify(filter, null, 2));
    console.log('listBooks sortField:', sortField, 'order:', direction);

    const [items, total] = await Promise.all([
      Book.find(filter)
        .sort({ [sortField]: direction, _id: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
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

/* ------------------------- REGISTER ------------------------- */
// POST /api/books/register
// Body: { BBreite, BHoehe, ...fields }
exports.registerBook = async (req, res) => {
  try {
    const { BBreite, BHoehe, ...fields } = req.body;
    const w = toNum(BBreite);
    const h = toNum(BHoehe);

    if (w === null || h === null) {
      return res.status(400).json({ error: 'BBreite and BHoehe (cm) are required' });
    }

    // map (w,h) -> size prefix from DB rules
    let prefix = await sizeToPrefixFromDb(w, h);
    if (!prefix) return res.status(400).json({ error: 'No matching size rule' });

    // pick a free BMark: exact prefix, fallback i->ik
    let picked = await BMarkf.findOneAndDelete(
      { BMark: new RegExp(`^${prefix}`, 'i') },
      { sort: { BMark: 1, rank: 1 } }
    ).lean();

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

    // Normalize & stamp control fields coming from form
    if (typeof fields.BHVorV === 'string') {
      const val = fields.BHVorV.trim().toUpperCase();
      if (val === 'H' || val === 'V') {
        fields.BHVorV = val;
        fields.BHVorVAt = new Date();
        fields.BMarkReleaseDue = sevenDaysFromNow();
      } else if (val === '') {
        delete fields.BHVorV;
      } else {
        return res.status(400).json({ error: 'BHVorV must be H or V' });
      }
    }

    if (typeof fields.BTop !== 'undefined') {
      fields.BTop = !!fields.BTop;
      // If Top is true at registration, stamp once
      fields.BTopAt = fields.BTop ? new Date() : null;
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
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

/* ------------------------- GET ONE ------------------------- */
// GET /api/books/:id
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

/* ------------------------- UPDATE (PATCH) ------------------------- */
// PATCH /api/books/:id
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe  != null) body.BHoehe  = toNum(body.BHoehe);

    // Top: if true and no timestamp yet, stamp now; if false, do NOT clear BTopAt
    if (typeof body.BTop === 'boolean') {
      if (body.BTop === true) {
        body.BTopAt = new Date();
      } else {
        // keep existing BTopAt; remove any accidental clear attempts
        delete body.BTopAt;
      }
    }

    // H/V: set flag & timestamp; schedule (or reschedule) release in 7 days
    if (body.BHVorV === 'H' || body.BHVorV === 'V') {
      body.BHVorVAt = new Date();
      body.BMarkReleaseDue = sevenDaysFromNow();
    }

    const updated = await Book.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ error: 'Book not found' });

    // Optional: recompute rank if you have a policy
    try {
      if (typeof computeRank === 'function') {
        const newRank = computeRank(updated);
        if (typeof newRank === 'number' && newRank !== updated.rank) {
          updated.rank = newRank;
          await updated.save();
        }
      }
    } catch (_) { /* non-fatal */ }

    res.json({ ...updated.toObject(), status: getStatus(updated) });
  } catch (err) {
    console.error('updateBook error:', err);
    res.status(400).json({ error: err.message || 'Bad request' });
  }
};

/* ------------------------- DELETE ------------------------- */
// DELETE /api/books/:id
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const mark = book.BMarkb;
    await Book.findByIdAndDelete(id);

    if (mark) {
      // return mark to pool (idempotent)
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

/* ------------------------- AUTOCOMPLETE ------------------------- */
// GET /api/books/autocomplete/:field?q=...
exports.autocomplete = async (req, res) => {
  try {
    const field = req.params.field || req.query.field;
    const { q } = req.query;

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
