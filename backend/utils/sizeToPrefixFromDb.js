// backend/utils/sizeToPrefixFromDb.js
const mongoose = require('mongoose');

function toNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
const round1 = x => Math.round(x * 10) / 10;

/**
 * Reads rules from the raw 'sizerules' collection and supports BOTH schemas:
 * A) wMin/wMax + bands[{hMin,hMax,equals,prefix}]
 * B) minB/maxB/maxBInc + bands[{condition:'lt'|'eq'|'gt', value, values, prefix}]
 */
exports.sizeToPrefixFromDb = async function sizeToPrefixFromDb(BBreite, BHoehe) {
  let w = toNum(BBreite);
  let h = toNum(BHoehe);
  if (w == null || h == null) return null;

  // tolerate mm → convert big numbers to cm
  if (w > 50) w /= 10;
  if (h > 50) h /= 10;

  w = round1(w);
  h = round1(h);

  // read raw documents to avoid model schema mismatches
  const col = mongoose.connection.db.collection('sizerules');

  // Fetch only fields we need
  const rawRules = await col
    .find({}, { projection: { wMin: 1, wMax: 1, priority: 1, bands: 1, minB: 1, maxB: 1, maxBInc: 1 } })
    .toArray();

  // Normalize to unified format: { wMin, wMax, includeMax, priority, bands:[{hMin,hMax,equals,prefix}] }
  const norms = rawRules.map(r => {
    const useAB = r.wMax != null || r.wMin != null; // schema A (old)
    const useB  = r.minB != null || r.maxB != null; // schema B (your seed)

    const wMin = useAB ? (r.wMin ?? null) : (useB ? (r.minB ?? null) : null);
    const wMax = useAB ? (r.wMax ?? null) : (useB ? (r.maxB ?? null) : null);
    const includeMax = useAB ? true : (useB ? (r.maxBInc !== false) : true); // default inclusive
    const priority = r.priority ?? 0;

    let bands = [];
    if (useAB) {
      bands = (r.bands || []).map(b => ({
        hMin: b.hMin ?? null,
        hMax: b.hMax ?? null,
        equals: Array.isArray(b.equals) ? b.equals.map(toNum).filter(x => x != null).map(round1) : [],
        prefix: b.prefix
      }));
    } else if (useB) {
      bands = (r.bands || []).flatMap(b => {
        if (b.condition === 'eq' && Array.isArray(b.values)) {
          return [{ hMin: null, hMax: null, equals: b.values.map(toNum).filter(x => x != null).map(round1), prefix: b.prefix }];
        }
        if (b.condition === 'lt') {
          const v = toNum(b.value);
          if (v == null) return [];
          return [{ hMin: null, hMax: v, equals: [], prefix: b.prefix }]; // h < v
        }
        if (b.condition === 'gt') {
          const v = toNum(b.value);
          if (v == null) return [];
          return [{ hMin: v, hMax: null, equals: [], prefix: b.prefix }]; // h >= v
        }
        return [];
      });
    }

    return { wMin, wMax, includeMax, priority, bands };
  });

  // Select width window: (wMin, wMax] by default, or (wMin, wMax] if includeMax=true, else (wMin, wMax)
  // i.e. require w > wMin (or wMin null), and w <= wMax if includeMax else w < wMax
  const matchesWidth = (rule) => {
    if (rule.wMax == null) return false; // must have an upper bound to compare
    const aboveMin = (rule.wMin == null) ? true : (w > rule.wMin);
    const belowMax = rule.includeMax ? (w <= rule.wMax) : (w < rule.wMax);
    return aboveMin && belowMax;
  };

  const candidates = norms.filter(matchesWidth).sort((a, b) => {
    // priority asc, then wMax asc (narrower first)
    if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0);
    return (a.wMax ?? 0) - (b.wMax ?? 0);
  });

  // Now pick band by height: equals first, then ranges (h >= hMin, h < hMax)
  for (const r of candidates) {
    for (const b of r.bands) {
      if (b.equals && b.equals.length) {
        if (b.equals.includes(h)) return b.prefix;
      }
    }
    for (const b of r.bands) {
      const okMin = b.hMin == null ? true : (h >= round1(b.hMin));
      const okMax = b.hMax == null ? true : (h < round1(b.hMax)); // exclusive upper
      if (okMin && okMax) return b.prefix;
    }
  }

  return null;
};
