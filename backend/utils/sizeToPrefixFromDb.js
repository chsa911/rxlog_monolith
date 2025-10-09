const SizeRule = require('../models/SizeRule');

function toNum(x) {
  if (typeof x === 'number') return x;
  const n = Number(String(x ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const round1 = (x) => Math.round(x * 10) / 10;

function widthInRange(w, r) {
  const { minB = null, maxB = null, minBInc = true, maxBInc = true } = r;
  if (minB != null && (minBInc ? w < minB : w <= minB)) return false;
  if (maxB != null && (maxBInc ? w > maxB : w >= maxB)) return false;
  return true;
}

function matchBand(h, b, tol = 0.2) {
  if (!b) return false;
  const { condition, value = null, values = [] } = b;
  if (condition === 'lt' && value != null) return h < value + tol;
  if (condition === 'gt' && value != null) return h > value - tol;
  if (condition === 'eq') return values.some(v => Math.abs(h - v) <= tol);
  return false;
}

/** Find series prefix for given width/height in cm. */
async function sizeToPrefixFromDb(widthCm, heightCm) {
  const tol = Number(process.env.TOL_CM || 0.2);
  const w = round1(toNum(widthCm));
  const h = round1(toNum(heightCm));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;

  const rules = await SizeRule.find({}).lean();
  const matches = rules.filter(r => widthInRange(w, r)).sort(
    (a, b) =>
      ((a.maxB ?? Infinity) - (a.minB ?? -Infinity)) -
      ((b.maxB ?? Infinity) - (b.minB ?? -Infinity))
  );

  for (const rule of matches) {
    // eq first (more specific)
    const eqs = rule.bands?.filter(b => b.condition === 'eq') || [];
    const others = rule.bands?.filter(b => b.condition !== 'eq') || [];

    for (const b of eqs) if (matchBand(h, b, tol)) return b.prefix;
    for (const b of others) if (matchBand(h, b, tol)) return b.prefix;
  }

  // fallback
  if (process.env.DEFAULT_SERIES) return process.env.DEFAULT_SERIES.trim();

  try {
    const Barcode = require('../models/Barcode');
    const row = await Barcode.aggregate([
      { $match: { $or: [{ isAvailable: true }, { status: { $in: ['free', 'available'] } }] } },
      { $group: { _id: '$series', c: { $sum: 1 } } },
      { $sort: { c: -1, _id: 1 } },
      { $limit: 1 },
    ]);
    if (row?.length) return row[0]._id;
  } catch {}
  return null;
}

module.exports = { sizeToPrefixFromDb };
