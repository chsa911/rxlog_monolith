const SizeRule = require('../models/SizeRule');

const EPS = 0.051; // ~ ±0.05 cm tolerance for equals (float safety)

/** if chosen prefix ends with 'i' and none free exist, caller may try 'ik' */
function normalizeI(prefix) {
  return prefix; // keep original; the allocation step does the fallback to 'ik'
}

async function sizeToPrefixFromDb(BBreite, BHoehe) {
  const w = Number(BBreite), h = Number(BHoehe);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;

  // find first width window where (wMin == null || w > wMin) && w <= wMax
  const rule = await SizeRule.findOne({
    wMax: { $gte: w },
    $or: [{ wMin: null }, { wMin: { $lt: w } }]
  }).sort({ wMax: 1, wMin: 1, priority: 1 }).lean();

  if (!rule || !rule.bands?.length) return null;

  // 1) equals wins (mid exact 20.5/21/21.5)
  const eqBand = rule.bands.find(b =>
    Array.isArray(b.equals) && b.equals.some(v => Math.abs(h - v) <= EPS)
  );
  if (eqBand) return normalizeI(eqBand.prefix);

  // 2) range bands
  const rngBand = rule.bands.find(b =>
    (b.hMin == null || h >= b.hMin) &&
    (b.hMax == null || h <  b.hMax)
  );

