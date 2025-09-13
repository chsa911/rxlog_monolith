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

// AND a "must have BMarkb" guard to the filter if requested
function applyOnlyMarkedGuard(filter, onlyMarked) {
  if (!onlyMarked) return filter;

  const guard = { BMarkb: { $exists: true, $type: 'string', $ne: '' } };

  if (filter.$or) {
    const orBlock = filter.$or;
    delete filter.$or;
    filter.$and = (filter.$and || []).concat([{ $or: orBlock }, guard]);
    return filter;
  }
  if (filter.$and) {
    filter.$and.push(guard);
    return filter;
  }
  Object.assign(filter, guard);
  return filter;
}

/* ========================= LIST (SEARCH) ========================= */
async function listBooks(req, res) {
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

    const onlyMarked = ['1','true','yes','on'].includes(String(req.query.onlyMarked || '').toLowerCase());
    const exactFlag  = ['1','true','yes','on'].includes(String(req.query.exact || '').toLowerCase());

    const ALLOWED_TEXT_FIELDS = ['BTitel','BAutor','BVerlag','BKw','BMarkb'];
    const fieldsFromQuery = String(req.query.fields || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => ALLOWED_TEXT_FIELDS.includes(s));

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;
    const direction = order === 'asc' ? 1 : -1;
    const sortField = sortBy || sort || 'BEind';

    const filter = {};

    if (q) {
      const cleaned = String(q).trim();

      const looksLikeBMark = /^[a-z]+[0-9]{2,}$/i.test(cleaned);
      const mRange = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
      const mGte  = cleaned.match(/^(?:>=\s*|)(\d+)\s*\+$/) || cleaned.match(/^>=\s*(\d+)$/);
      const mLte  = cleaned.match(/^<=\s*(\d+)$/) || cleaned.match(/^(\d+)\s*-[ ]*$/);
      const mEq   = cleaned.match(/^\d+$/);

      // FORCE exact BMark match if the query looks like a mark OR fields include BMarkb
      if (looksLikeBMark || fieldsFromQuery.includes('BMarkb')) {
        const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.BMarkb = new RegExp(`^${escaped}$`, 'i');
      }
      // Numeric/range pages on BSeiten (support legacy 'Bseiten' too)
      else if (mRange || mGte || mLte || mEq) {
        const pageFields = ['BSeiten', 'Bseiten'];
        const convInt    = (f) => ({ $convert: { input: `$${f}`, to: 'int', onError: null, onNull: null } });
        const toText     = (f) => ({ $toString: `$${f}` });
        const matchRange = (f) => ({ $regexFind: { input: toText(f), regex: /(\d+)\s*[-–—]\s*(\d+)/ } });

        if (mRange) {
          const lo = Number(mRange[1]);
          const hi = Number(mRange[2]);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: { $gte: lo, $lte: hi } })),
            ...pageFields.map(f => ({ $expr: { $let: { vars: { m: matchRange(f) }, in: {
              $and: [
                { $ne: ['$$m', null] },
                { $lte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 0] } }, hi ] },
                { $gte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 1] } }, lo ] },
              ]
            }}}})),
            ...pageFields.map(f => ({ $expr: {
              $and: [
                { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                { $lte: [ lo, { $toInt: { $replaceAll: { input: toText(f), find: '+', replacement: '' } } } ] }
              ]
            }})),
          ];
        } else if (mGte) {
          const x = Number(mGte[1]);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: { $gte: x } })),
            ...pageFields.map(f => ({ $expr: { $gte: [ convInt(f), x ] } })),
            ...pageFields.map(f => ({ $expr: {
              $and: [
                { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                { $gte: [ { $toInt: { $replaceAll: { input: toText(f), find: '+', replacement: '' } } }, x ] }
              ]
            }})),
            ...pageFields.map(f => ({ $expr: { $let: { vars: { m: matchRange(f) }, in: {
              $and: [
                { $ne: ['$$m', null] },
                { $gte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 1] } }, x ] }
              ]
            }}}})),
          ];
        } else if (mLte) {
          const x = Number(mLte[1]);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: { $lte: x } })),
            ...pageFields.map(f => ({ $expr: { $lte: [ convInt(f), x ] } })),
            ...pageFields.map(f => ({ $expr: { $let: { vars: { m: matchRange(f) }, in: {
              $and: [
                { $ne: ['$$m', null] },
                { $lte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 0] } }, x ] }
              ]
            }}}})),
          ];
        } else { // mEq
          const x = Number(cleaned);
          filter.$or = [
            ...pageFields.map(f => ({ [f]: x })),
            ...pageFields.map(f => ({ $expr: { $eq: [ convInt(f), x ] } })),
            ...pageFields.map(f => ({ $expr: { $let: { vars: { m: matchRange(f) }, in: {
              $and: [
                { $ne: ['$$m', null] },
                { $lte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 0] } }, x ] },
                { $gte: [ { $toInt: { $arrayElemAt: ['$$m.captures', 1] } }, x ] },
              ]
            }}}})),
            ...pageFields.map(f => ({ $expr: {
              $and: [
                { $regexMatch: { input: toText(f), regex: /^\s*(\d+)\s*\+$/ } },
                { $lte: [ x, { $toInt: { $replaceAll: { input: toText(f), find: '+', replacement: '' } } } ] }
              ]
            }})),
          ];
        }
      }
      // ----- TEXT search (non-numeric and not forced BMark) -----
      else {
        const textFields = fieldsFromQuery.length
          ? fieldsFromQuery
          : ['BTitel','BAutor','BVerlag','BKw','BMarkb'];

        // Exact if requested OR fields are scoped → exact literal match (case-insensitive, trimmed)
        const exactRequested = exactFlag || fieldsFromQuery.length > 0;

        if (exactRequested) {
          const lc = cleaned.toLowerCase();
          filter.$or = textFields.map(f => ({
            $expr: {
              $eq: [
                { $toLower: { $trim: { input: `$${f}` } } },
                lc
              ]
            }
          }));
        } else {
          const rx = new RegExp(cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.$or = textFields.map(f => ({ [f]: rx }));
        }
      }
    } else {
      if (createdFrom || createdTo) {
        filter.BEind = {};
        if (createdFrom) filter.BEind.$gte = new Date(createdFrom + 'T00:00:00.000Z');
        if (createdTo)   filter.BEind.$lt  = new Date(createdTo   + 'T23:59:59.999Z');
      }
    }

    // Apply "only with BMark"
    applyOnlyMarkedGuard(filter, onlyMarked);

    const [items, total] = await Promise.all([
      Book.find(filter).sort({ [sortField]: direction, _id: -1 }).skip(skip).limit(lim).lean(),
      Book.countDocuments(filter),
    ]);

    const data = items.map((b) => normalizeBook({ ...b, status: getStatus(b) }));
    res.json({ data, page: pg, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (err) {
    console.error('listBooks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/* ========================= REGISTER (POST /api/books/register) ========================= */
async function registerBook(req, res) {
  try {
    const { BBreite, BHoehe, ...fields } = req.body;
    const w = toNum(BBreite);
    const h = toNum(BHoehe);
    if (w === null || h === null) {
      return res.status(400).json({ error: 'BBreite and BHoehe (cm) are required' });
    }

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

    // Normalizations from form
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
      fields.BTopAt = fields.BTop ? new Date() : null;
    }

    const doc = await Book.create({
      BBreite: w,
      BHoehe: h,
      ...fields,
      BMarkb: picked.BMark,
    });

    res.status(201).json({ ...normalizeBook(doc.toObject()), status: getStatus(doc) });
  } catch (err) {
    console.error('registerBook error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

/* ========================= GET ONE (GET /api/books/:id) ========================= */
async function getBook(req, res) {
  try {
    const { id } = req.params;
    const book = await Book.findById(id).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ ...normalizeBook(book), status: getStatus(book) });
  } catch (err) {
    console.error('getBook error:', err);
    res.status(400).json({ error: 'Bad request' });
  }
}

/* ========================= UPDATE (PATCH /api/books/:id) ========================= */
async function updateBook(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.BBreite != null) body.BBreite = toNum(body.BBreite);
    if (body.BHoehe  != null) body.BHoehe  = toNum(body.BHoehe);

    if (typeof body.BTop === 'boolean') {
      if (body.BTop === true) body.BTopAt = new Date();
      else delete body.BTopAt;
    }

    if (body.BHVorV === 'H' || body.BHVorV === 'V') {
      body.BHVorVAt = new Date();
      body.BMarkReleaseDue = sevenDaysFromNow();
    }

    const updated = await Book.findByIdAndUpdate(id, body, {
      new: true, runValidators: true,
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
    } catch (_) { /* ignore rank errors */ }

    const obj = updated.toObject();
    res.json({ ...normalizeBook(obj), status: getStatus(updated) });
  } catch (err) {
    console.error('updateBook error:', err);
    res.status(400).json({ error: err.message || 'Bad request' });
  }
}

/* ========================= DELETE (DELETE /api/books/:id) ========================= */
async function deleteBook(req, res) {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const mark = book.BMarkb;
    await Book.findByIdAndDelete(id);

    if (mark) {
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
}

/* ========================= AUTOCOMPLETE (GET /api/books/autocomplete/:field) ========================= */
async function autocomplete(req, res) {
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
}

/* ------------------------- exports ------------------------- */
module.exports = {
  listBooks,
  registerBook,
  getBook,
  updateBook,
  deleteBook,
  autocomplete,
};
