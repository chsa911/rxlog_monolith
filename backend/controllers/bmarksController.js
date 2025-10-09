const Barcode = require('../models/Barcode');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

function toNumberLoose(x) {
  if (typeof x === 'number') return x;
  if (typeof x !== 'string') return NaN;
  const s = x.trim().replace(/\s+/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    try { prefix = await sizeToPrefixFromDb(w, h); }
    catch (e) { console.error('[preview-by-size] sizeToPrefixFromDb failed:', e); return res.status(500).json({ error: 'Size mapping error', message: e.message }); }

    if (!prefix) return res.json({ prefix: null, items: [], available: 0 });

    const query = {
      series: new RegExp(`^${escapeRx(prefix)}$`, 'i'),
      $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }],
    };

    const [items, count] = await Promise.all([
      Barcode.find(query).sort({ rank: 1, triplet: 1, code: 1 }).limit(30).lean(),
      Barcode.countDocuments(query),
    ]);

    const data = items.map(x => ({ BMark: x.code, rank: typeof x.rank === 'number' ? x.rank : 0 }));
    return res.json({ prefix, items: data, available: count });
  } catch (err) {
    console.error('[preview-by-size] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function preview(req, res) {
  try {
    const { series } = req.query;
    if (series) {
      const query = {
        series: new RegExp(`^${escapeRx(series)}$`, 'i'),
        $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }],
      };
      const [items, count] = await Promise.all([
        Barcode.find(query).sort({ rank: 1, triplet: 1, code: 1 }).limit(50).lean(),
        Barcode.countDocuments(query),
      ]);
      return res.json({ series, items: items.map(x => ({ BMark: x.code, rank: x.rank ?? 0 })), available: count });
    }

    const rows = await Barcode.aggregate([
      { $match: { $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }] } },
      { $group: { _id: '$series', available: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map(r => ({ series: r._id, available: r.available })));
  } catch (err) {
    console.error('[preview] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function release(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id or code required' });

    const match = /^[0-9a-f]{24}$/i.test(id) ? { _id: id } : { code: id };
    const result = await Barcode.updateOne(match, {
      $set: { isAvailable: true, status: 'available', reservedAt: null, assignedBookId: null },
    });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Barcode not found' });

    res.status(204).end();
  } catch (err) {
    console.error('[release] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { previewBySize, preview, release };
