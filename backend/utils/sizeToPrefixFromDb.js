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
 * Supports BOTH schemas in 'sizerules' collection:
 * A) { wMin, wMax, priority, bands:[{hMin,hMax,equals,prefix}] }
 * B) { minB, maxB, maxBInc, bands:[{condition:'lt'|'eq'|'gt', value, values, prefix}] }
 */
exports.sizeToPrefixFromDb = async function sizeToPrefixFromDb(BBreite, BHoehe) {
  let w = toNum(BBreite);
  let h = toNum(BHoehe);
  if (w == null || h == null) return null;

  // tolerate mm → cm
  if (w > 50) w /= 10;
  if (h > 50) h /= 10;

  w = round1(w);
  h = round1(h);

  const col = mongoose.connection.db.collection('sizerules');

  const rawRules = await col.find(
    {},
    { projection: { wMin: 1, wMax: 1, priority: 1, bands: 1, minB: 1, maxB: 1, maxBInc: 1 } }
  ).toArray();

  // Normalize into unified rules with explicit inclusivity
  // width: [wMinInc=true] and [wMaxInc = schemaB.maxBInc or true]
  // height bands:
  //   - equals: exact values
  //   - lt v  → hMax=v with hMaxInc=true  (≤ v)
  //   - gt v  → hMin=v with hMinInc=false (≥ v)  ← we’ll treat ≥ by using false and compare h > v OR equals handled before
  const norms = rawRules.map(r => {
    const useA = (r.wMax != null || r.wMin != null);
    const useB = (r.minB != null || r.maxB != null);

    const wMin = useA ? (r.wMin ?? null) : (useB ? (r.minB ?? null) : null);
    const wMax = useA ? (r.wMax ?? null) : (useB ? (r.maxB ?? null) : null);
    const wMinInc = true; // inclusive lower bound to avoid holes at min
    const wMaxInc = useA ? true : (useB ? (r.maxBInc !== false) : true);
    const priority = r.priority ?? 0;

    let bands = [];
    if (useA) {
      bands = (r.bands || []).map(b => ({
        hMin: b.hMin ?? null,
        hMax: b.hMax ?? null,
        hMinInc: b.hMin != null, // default inclusive if provided
        hMaxInc: false,          // default exclusive upper unless explicitly set in A (not used)
        equals: Array.isArray(b.equals) ? b.equals.map(toNum).filter(x => x != null).map(round1) : [],
        prefix: b.prefix
      }));
    } else if (useB) {
      bands = (r.bands || []).flatMap(b => {
        if (b.condition === 'eq' && Array.isArray(b.values)) {
          return [{
            hMin: null, hMax: null, hMinInc: false, hMaxInc: false,
            equals: b.values.map(toNum).filter(x => x != null).map(round1),
            prefix: b.prefix
          }];
        }
        if (b.condition === 'lt') {
          const v = toNum(b.value);
          if (v == null) return [];
          return [{
            hMin: null, hMax: v, hMinInc: false, hMaxInc: true,  // ≤ v  (INCLUSIVE!)
            equals: [], prefix: b.prefix
          }];
        }
        if (b.condition === 'gt') {
          const v = toNum(b.value);
          if (v == null) return [];
          return [{
            hMin: v, hMax: null, hMinInc: false, hMaxInc: false, // > v (equals handled by 'eq' band if present)
            equals: [], prefix: b.prefix
          }];
        }
        return [];
      });
    }

    return { wMin, wMax, wMinInc, wMaxInc, priority, bands };
  });

  // Width window match: inclusive lower, upper by wMaxInc
  const matchesWidth = (rule) => {
    if (rule.wMax == null && rule.wMin == null) return false;
    const aboveMin = (rule.wMin == null) ? true : (rule.wMinInc ? (w >= round1(rule.wMin)) : (w > round1(rule.wMin)));
    const belowMax = (rule.wMax == null) ? true : (rule.wMaxInc ? (w <= round1(rule.wMax)) : (w < round1(rule.wMax)));
    return aboveMin && belowMax;
  };

  const candidates = norms
    .filter(matchesWidth)
    .sort((a, b) => {
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0);
      // narrower first
      return (a.wMax ?? Infinity) - (b.wMax ?? Infinity);
    });

  // Height selection: equals first, then ranges with inclusivity
  for (const r of candidates) {
    // equals first
    for (const b of r.bands) {
      if (b.equals && b.equals.length) {
        if (b.equals.includes(h)) return b.prefix;
      }
    }
    // ranged
    for (const b of r.bands) {
      if (b.equals && b.equals.length) continue;
      const minOK = (b.hMin == null) ? true :
        (b.hMinInc ? (h >= round1(b.hMin)) : (h > round1(b.hMin)));
      const maxOK = (b.hMax == null) ? true :
        (b.hMaxInc ? (h <= round1(b.hMax)) : (h < round1(b.hMax)));
      if (minOK && maxOK) return b.prefix;
    }
  }

  return null;
};
