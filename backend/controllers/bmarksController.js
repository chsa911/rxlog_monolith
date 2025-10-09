// backend/controllers/bmarksController.js
const Barcode = require('../models/Barcode');
const Book = require('../models/Book');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

/* ------------------------- helpers ------------------------- */
function toNumberLoose(x) {
  if (typeof x === 'number') return x;
  if (typeof x !== 'string') return NaN;
  const s = x.trim().replace(/\s+/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Aggregate available barcodes for a given series, excluding codes referenced by books.
 * Returns { items: [{BMark, rank}...], available: <int> }
 */
async function aggregateSeriesPreview(series, limit = 30) {
  const seriesRx = new RegExp(`^${escapeRx(series)}$`, 'i');

  // main list (first N items)
  const list = await Barcode.aggregate([
    {
      $match: {
        series: seriesRx,
        $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }],
      },
    },
    // Exclude codes already referenced by a book (BMarkb or barcode)
    {
      $lookup: {
        from: 'books',
        let: { c: '$code' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$BMarkb', '$$c'] },
                  { $eq: ['$barcode', '$$c'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'uses',
      },
    },
    { $match: { uses: { $size: 0 } } },
    { $sort: { rank: 1, triplet: 1, code: 1 } },
    { $limit: Math.max(1, Math.min(200, limit)) },
    { $project: { _id: 0, BMark: '$code', rank: { $ifNull: ['$rank', 0] } } },
  ]);

  // count total available for the series (excluding used)
  const countAgg = await Barcode.aggregate([
    {
      $match: {
        series: seriesRx,
        $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }],
      },
    },
    {
      $lookup: {
        from: 'books',
        let: { c: '$code' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$BMarkb', '$$c'] },
                  { $eq: ['$barcode', '$$c'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'uses',
      },
    },
    { $match: { uses: { $size: 0 } } },
    { $count: 'available' },
  ]);

  const available = countAgg.length ? countAgg[0].available : 0;
  return { items: list, available };
}

/* ========================= GET /api/bmarks/preview-by-size =========================
   Query: ?BBreite=..&BHoehe=..
   Returns: { prefix, items: [{BMark, rank}...], available }
============================================================================= */
async function previewBySize(req, res) {
  try {
    const rawBreite = req.query.BBreite ?? req.query.width ?? req.query.breite;
    const rawHoehe  = req.query.BHoehe  ?? req.query.height ?? req.query.hoehe;

    const w = toNumberLoose(rawBreite);
    const h = toNumberLoose(rawHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: 'Invalid dimensions', BBreite: rawBreite, BHoehe: rawHoehe });
    }

    let prefix;
    try {
      prefix = await sizeToPrefixFromDb(w, h);
    } catch (e) {
      console.error('[preview-by-size] sizeToPrefixFromDb failed:', e);
      return res.status(500).json({ error: 'Size mapping error', message: e.message });
    }
    if (!prefix) {
      // graceful empty response
      return res.json({ prefix: null, items: [], available: 0 });
    }

    const { items, available } = await aggregateSeriesPreview(prefix, 30);
    return res.json({ prefix, items, available });
  } catch (err) {
    console.error('[preview-by-size] error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Server error' });
  }
}

/* ========================= GET /api/bmarks/preview =========================
   Optional query: ?series=ei (or any)
   - With series: returns { series, items, available }
   - Without series: returns [{ series, available }] overview across all series
============================================================================= */
async function preview(req, res) {
  try {
    const { series } = req.query;

    if (series) {
      const { items, available } = await aggregateSeriesPreview(series, 50);
      return res.json({ series, items, available });
    }

    // Overview: available counts per series (excluding codes referenced by books)
    const usedCodes = new Set([
      ...(await Book.distinct('BMarkb', { BMarkb: { $type: 'string', $ne: '' } })),
      ...(await Book.distinct('barcode', { barcode: { $type: 'string', $ne: '' } })),
    ]);

    const rows = await Barcode.aggregate([
      {
        $match: {
          $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }],
          code: { $nin: Array.from(usedCodes) },
        },
      },
      { $group: { _id: '$series', available: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return res.json(rows.map(r => ({ series: r._id, available: r.available })));
  } catch (err) {
    console.error('[preview] error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Server error' });
  }
}

/* ========================= PATCH /api/bmarks/:id/release =========================
   :id can be a full code (e.g., "egk001") or a Mongo _id.
   Marks barcode back to available. Does NOT touch books.
============================================================================= */
async function release(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id or code required' });

    const match = /^[0-9a-f]{24}$/i.test(id) ? { _id: id } : { code: id };

    const result = await Barcode.updateOne(
      match,
      { $set: { isAvailable: true, status: 'available', reservedAt: null, assignedBookId: null } }
    );

    if (result.matchedCount === 0 && result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Barcode not found' });
    }
    return res.status(204).end();
  } catch (err) {
    console.error('[release] error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  previewBySize,
  preview,
  release,
};
