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

// Normalize legacy/casing and numeric strings for a plain book object
function normalizeBook(b) {
  const x = { ...b };

  // Fix common legacy/casing variants
  if (x.Bseiten != null && x.BSeiten == null) x.BSeiten = Number(x.Bseiten);
  if (x.Bkw != null && x.BKw == null) x.BKw = x.Bkw;
  if (x.Bverlag != null && x.BVerlag == null) x.BVerlag = x.Bverlag;
  if (x.Bw1 != null && x.BKw1 == null) x.BKw1 = x.Bw1;

  // Convert numeric strings with commas to numbers
  if (typeof x.BBreite === 'string') x.BBreite = toNum(x.BBreite);
  if (typeof x.BHoehe  === 'string') x.BHoehe  = toNum(x.BHoehe);

  // Drop legacy keys for a clean, canonical shape
  delete x.Bseiten;
  delete x.Bkw;
  delete x.Bverlag;
  delete x.Bw1;

  // Ignore oddball BEind* if present (keep BEind if it exists)
  if (x['BEind*'] != null && x.BEind == null) delete x['BEind*'];

  return x;
}

/* ========================= LIST (SEARCH) =========================
   GET /api/books
   Query: q, page, limit, sort/sortBy, order, createdFrom, createdTo
   - If q looks like a BMark (letters+digits): exact match on BMarkb (case-insensitive)
   - If q numeric/range: BSeiten search (checks both BSeiten and legacy Bseiten)
     Supports: 180-220, >=200, <=150, 200+
   - Else text: BTitel/BAutor/BVerlag/BKw/BMarkb
   - Date filter (BEind) applies ONLY when q is empty
=================================================================== */
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

    // support both ?sort= and ?sortBy=
    const sortField = sortBy || sort || 'BEind';

    const filter = {};

    if (q) {
      const cleaned = String(q).trim();

      // ---- SPECIAL CASE: direct BMark lookup (letters + digits) ----
      const isBMarkPattern =
        /^[a-z]+[0-9]{2,}$/i.test(cleaned) ||            // letters then digits (e.g., "ekg030")
        (/[a-z]/i.test(cleaned) && /\d/.test(cleaned));  // contains both letters and digits

      if (isBMarkPattern) {
        const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.BMarkb = new RegExp(`^${escaped}$`, "i");
      } else {
        // -------- BSeiten numeric/range OR generic text search --------
        // Support both canonical and legacy page fields
        const pageFields = ["BSeiten", "Bseiten"];
        const convInt     = (f) => ({ $convert: { input: `$${f}`, to: "int", onError: null, onNull: null } });
        const toText      = (f) => ({ $toString: `$${f}` });
        const matchRange  = (f) => ({ $regexFind: { input: toText(f), regex: /(\d+)\s*[-–—]\s*(\d+)/ } });

        const mRange = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)$/);            // "180-220"
        const mGte  = cleaned.match(/^(?:>=\s*|)(\d+)\s*\+$/) ||            // "200+"
                      cleaned.match(/^>=\s*(\d+)$/);                         // ">=200"
        const mLte  = cleaned.match(/^<=\s*(\d+)$/) ||                      // "<=150"
                      cleaned.match(/^(\d+)\s*-[ ]*$/);                      // "150-"
        const mEq   = cleaned.match(/^\d+$/);                                // "200"

        if (mRange) {
          const lo = Number(mRange[1]);
          const hi = Number(mRange[2]);
          filter.$or = [
            // numeric range on either field
            ...pageFields.map(f => ({ [f]: { $gte: lo, $lte: hi } })),
            // string "a-b" overlapping [lo, hi]
            ...pageFields.map(f => ({
              $expr: {
                $let: { vars: { m: matchRange(f) }, in: {
                  $and: [
                    { $ne: ["$$m", null] },
                    { $lte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 0] } }, hi ] },
                    { $gte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 1] } }, lo ] },
                  ]
                } }
              }
            })),
            // "x+" overlapping [lo, hi]
            ...pageFields.map(f => ({
              $expr: {
                $and: [
                  { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                  { $lte: [ lo, { $toInt: { $replaceAll: { input: toText(f), find: "+", replacement: "" } } } ] }
                ]
              }
            })),
          ];
        } else if (mGte) {
          const x = Number(mGte[1]);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: { $gte: x } })),
            ...pageFields.map(f => ({ $expr: { $gte: [ convInt(f), x ] } })),
            // "x+"
            ...pageFields.map(f => ({
              $expr: {
                $and: [
                  { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                  { $gte: [ { $toInt: { $replaceAll: { input: toText(f), find: "+", replacement: "" } } }, x ] }
                ]
              }
            })),
            // string range with docHi >= x
            ...pageFields.map(f => ({
              $expr: {
                $let: { vars: { m: matchRange(f) }, in: {
                  $and: [
                    { $ne: ["$$m", null] },
                    { $gte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 1] } }, x ] }
                  ]
                } }
              }
            })),
          ];
        } else if (mLte) {
          const x = Number(mLte[1]);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: { $lte: x } })),
            ...pageFields.map(f => ({ $expr: { $lte: [ convInt(f), x ] } })),
            // string range with docLo <= x
            ...pageFields.map(f => ({
              $expr: {
                $let: { vars: { m: matchRange(f) }, in: {
                  $and: [
                    { $ne: ["$$m", null] },
                    { $lte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 0] } }, x ] }
                  ]
                } }
              }
            })),
          ];
        } else if (mEq) {
          const x = Number(cleaned);
          filter.$or = [
            // direct equality on either field
            ...pageFields.map(f => ({ [f]: x })),
            // equality after string→int conversion
            ...pageFields.map(f => ({ $expr: { $eq: [ convInt(f), x ] } })),
            // string range "a-b" that contains x
            ...pageFields.map(f => ({
              $expr: {
                $let: { vars: { m: matchRange(f) }, in: {
                  $and: [
                    { $ne: ["$$m", null] },
                    { $lte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 0] } }, x ] },
                    { $gte: [ { $toInt: { $arrayElemAt: ["$$m.captures", 1] } }, x ] },
                  ]
                } }
              }
            })),
            // "x+" interpreted as [x, +∞)
            ...pageFields.map(f => ({
              $expr: {
                $and: [
                  { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                  { $lte: [ x, { $toInt: { $replaceAll: { input: toText(f), find: "+", replacement: "" } } } ] }
                ]
              }
            })),
          ];
        } else {
          // Text search across fields (fallback)
          const rx = new RegExp(cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.$or = [{ BTitel: rx }, { BAutor: rx }, { BVerlag: rx }, { BKw: rx }, { BMarkb: rx }];
        }
      }
    } else {
      // Only apply date filter if q is empty
      if (createdFrom || createdTo) {
        filter.BEind = {};
        if (createdFrom) filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
        if (createdTo)   filter.BEind.$lt  = new Date(createdTo   + 'T23:59:59.999Z');
      }
    }

    const [items, total] = await Promise.all([
      Book.find(filter)
        .sort({ [sortField]: direction, _id: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Book.countDocuments(filter),
    ]);

    // Normalize every document before sending to the client
    const data = items.map((b) => normalizeBook({ ...b, status: getStatus(b) }));

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

/* ========================= REGISTER =========================
   POST /api/books/register
   Body: { BBreite, BHoehe, ...fields }
================================================================ */
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

    res.json({ ...normalizeBook(doc.toObject()), status: getStatus(doc) });
  } catch (err) {
    console.error('registerBook error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

/* ========================= GET ONE =========================
   GET /api/books/:id
================================================================ */
exports.getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ ...normalizeBook(book), status: getStatus(book) });
  } catch (err) {
    console.error('getBook error:', err);
    res.status(400).json({ error: 'Bad request' });
  }
};

/* ========================= UPDATE (PATCH) =========================
   PATCH /api/books/:id
================================================================ */
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe  != null) body.BHoehe  = toNum(body.BHoehe);

    // Top: if true stamp now; if false do NOT clear BTopAt
    if (typeof body.BTop === 'boolean') {
      if (body.BTop === true) {
        body.BTopAt = new Date();
      } else {
        delete body.BTopAt; // keep existing timestamp
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

    // Optional: recompute rank if applicable
    try {
      if (typeof computeRank === 'function') {
        const newRank = computeRank(updated);
        if (typeof newRank === 'number' && newRank !== updated.rank) {
          updated.rank = newRank;
          await updated.save();
        }
      }
    } catch (_) { /* non-fatal */ }

    const obj = updated.toObject();
    res.json({ ...normalizeBook(obj), status: getStatus(updated) });
  } catch (err) {
    console.error('updateBook error:', err);
    res.status(400).json({ error: err.message || 'Bad request' });
  }
};

/* ========================= DELETE =========================
   DELETE /api/books/:id
================================================================ */
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

/* ========================= AUTOCOMPLETE =========================
   GET /api/books/autocomplete/:field?q=...
   Allowed fields: BAutor, BKw, BVerlag
================================================================ */
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
