// utils/sizeToPrefixFromDb.js
// cm-based size mapping with equals-first logic

// --- helpers --------------------------------------------------------------

/** normalize number: allow "12,5" or "12.5"; returns Number or null */
function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** round to 1 decimal for robust equals matching like 20.5 / 21 / 21.5 */
function round1(n) {
  return Math.round(n * 10) / 10;
}

/** band test: equals first, then range (h >= hMin && h < hMax) */
function matchBand(h, band) {
  const H = round1(h);
  // equals first (if provided)
  if (Array.isArray(band.equals) && band.equals.length) {
    for (const val of band.equals) {
      const ev = round1(toNum(val));
      if (ev !== null && H === ev) return true;
    }
    // if equals exists and didn't match, do NOT fall back to range in this band
    // (design: equals are exclusive to that band entry)
    return false;
  }
  // range
  const hMin = toNum(band.hMin);
  const hMax = toNum(band.hMax);
  const geMin = (hMin === null) || (H >= hMin);
  const ltMax = (hMax === null) || (H < hMax);
  return geMin && ltMax;
}

/** width window semantics: (wMin, wMax] */
function matchWidth(w, rule) {
  const W = toNum(w);
  const wMin = toNum(rule.wMin);
  const wMax = toNum(rule.wMax);
  if (wMax === null) return false;     // we require an upper bound
  const gtMin = (wMin === null) ? true : (W > wMin);
  const leMax = (W <= wMax);
  return gtMin && leMax;
}

// --- in-memory version (for tests / fallback) ----------------------------

// equals set used across rules
const EQUALS = [20.5, 21, 21.5];

/** convenience creators */
const bandRange = (hMin, hMax, prefix) => ({ hMin, hMax, equals: [], prefix });
const bandEquals = (prefix) => ({ hMin: null, hMax: null, equals: EQUALS, prefix });

/**
 * Minimal demo rule table (CM!) matching your schema style.
 * Add the remaining sizes (4..20) following the same pattern.
 */
const IN_MEMORY_RULES = [
  // size 0: w <= 10.5
  {
    wMin: null, wMax: 10.5, priority: 10,
    bands: [
      bandRange(null, 17.5, 'egk'),
      bandEquals('lgk'),
      bandRange(17.5, null, 'ogk'),
    ]
  },
  // size 1: (10.5, 11.3]
  {
    wMin: 10.5, wMax: 11.3, priority: 10,
    bands: [
      bandRange(null, 18, 'eak'),
      bandEquals('lak'),
      bandRange(18, null, 'oak'),
    ]
  },
  // size 2: (11.3, 11.4]
  {
    wMin: 11.3, wMax: 11.4, priority: 10,
    bands: [
      bandRange(null, 18, 'ekb'),
      // add more bands if needed
    ]
  },
  // size 3: (11.4, 11.8]
  {
    wMin: 11.4, wMax: 11.8, priority: 10,
    bands: [
      bandRange(null, 18, 'eb'),
      bandEquals('lb'),
      bandRange(18, null, 'ob'),
    ]
  },
  // ... add sizes 4..20 per your table
];

/**
 * In-memory cm-mapper (no DB). Returns prefix or null.
 */
async function sizeToPrefixInMemory(BBreite, BHoehe) {
  const w = toNum(BBreite);
  const h = toNum(BHoehe);
  if (w === null || h === null) return null;

  // choose candidate rules by width window
  const candidates = IN_MEMORY_RULES
    .filter(r => matchWidth(w, r))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.wMax ?? 0) - (b.wMax ?? 0));

  for (const rule of candidates) {
    // equals-first bands first, then range bands
    const eqBands = rule.bands.filter(b => Array.isArray(b.equals) && b.equals.length);
    for (const b of eqBands) {
      if (matchBand(h, b)) return b.prefix;
    }
    const rangeBands = rule.bands.filter(b => !b.equals || !b.equals.length);
    for (const b of rangeBands) {
      if (matchBand(h, b)) return b.prefix;
    }
  }
  return null;
}

// --- Mongo / SizeRule version --------------------------------------------

/**
 * Mongo version. Requires models/SizeRule with:
 * {
 *   wMin: Number|null, wMax: Number, priority: Number,
 *   bands: [{ hMin:Number|null, hMax:Number|null, equals:[Number], prefix:String }]
 * }
 */
async function sizeToPrefixFromDb(BBreite, BHoehe) {
  const w = toNum(BBreite);
  const h = toNum(BHoehe);
  if (w === null || h === null) return null;

  // lazy require to avoid circular imports
  const SizeRule = require('../models/SizeRule');

  // prefilter candidates by width window: (wMin, wMax]
  // w <= wMax AND (wMin is null OR w > wMin)
  const candidates = await SizeRule.find({
    wMax: { $gte: w },
    $or: [{ wMin: null }, { wMin: { $lt: w } }],
  })
    .sort({ priority: -1, wMax: 1 })  // higher priority first, then tighter upper bound
    .lean();

  if (!candidates || !candidates.length) return null;

  const H = round1(h);

  // within each rule: equals-first, then ranges
  for (const rule of candidates) {
    if (!matchWidth(w, rule)) continue; // safety (due to null/strictness nuances)

    const bands = Array.isArray(rule.bands) ? rule.bands : [];

    // equals-first
    for (const band of bands) {
      if (Array.isArray(band.equals) && band.equals.length) {
        const anyEq = band.equals.some(v => round1(toNum(v)) === H);
        if (anyEq) return band.prefix;
      }
    }
    // ranges next
    for (const band of bands) {
      if (!band.equals || !band.equals.length) {
        if (matchBand(h, band)) return band.prefix;
      }
    }
  }

  return null;
}

module.exports = {
  sizeToPrefixFromDb,
  sizeToPrefixInMemory,
  // expose helpers for tests if you like:
  _priv: { toNum, round1, matchBand, matchWidth, IN_MEMORY_RULES, EQUALS }
};
