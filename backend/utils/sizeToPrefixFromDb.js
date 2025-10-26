// utils/sizeToPrefixFromDb.js
const SizeRule = require("../models/SizeRule");

// normalize "24,6" -> 24.6 (same as your toNumberLoose)
function parseNum(x) {
  if (typeof x === "number") return x;
  return Number(String(x).trim().replace(",", "."));
}

function coversWidth(doc, W) {
  // Prefer new-style: scope.W.{min,max,minInclusive,maxInclusive}
  const sw = doc.scope?.W;
  if (sw) {
    const min = sw.min ?? -Infinity;
    const max = sw.max ?? Infinity;
    const minInc = sw.minInclusive !== false; // default true
    const maxInc = sw.maxInclusive !== false; // default true
    const lowerOk = minInc ? W >= min : W > min;
    const upperOk = maxInc ? W <= max : W < max;
    return lowerOk && upperOk;
  }
  // Legacy: minW/maxW or minB/maxB
  const min = doc.minW ?? doc.minB ?? -Infinity;
  const max = doc.maxW ?? doc.maxB ?? Infinity;
  const minInc = (doc.minWInc ?? doc.minBInc) !== false;
  const maxInc = (doc.maxWInc ?? doc.maxBInc) !== false;
  const lowerOk = minInc ? W >= min : W > min;
  const upperOk = maxInc ? W <= max : W < max;
  return lowerOk && upperOk;
}

// Option-1 band resolution:
// 1) eq wins if H exactly equals any value
// 2) else if H <= lt.value -> lt
// 3) else -> gt
function pickBand(scope, H) {
  const bands = Array.isArray(scope.bands) ? scope.bands : [];

  // 1) exacts
  for (const b of bands) {
    if (b?.condition === "eq" && Array.isArray(b.values) && b.values.includes(H)) {
      return b;
    }
  }

  // 2) thresholds
  const lt = bands.find(b => b?.condition === "lt" && typeof b.value === "number");
  const gt = bands.find(b => b?.condition === "gt" && typeof b.value === "number");

  if (!lt && !gt) return null;
  const T = lt?.value ?? gt?.value; // they should share the same threshold

  if (lt && H <= T) return lt; // inclusive
  if (gt) return gt;           // strictly greater
  return null;
}

/**
 * Given (width, height), return the prefix string (e.g., 'lgk', 'egk', 'ogk'),
 * or null if no scope/band matches.
 */
async function sizeToPrefixFromDb(widthRaw, heightRaw) {
  const W = parseNum(widthRaw);
  const H = parseNum(heightRaw);

  if (!Number.isFinite(W) || !Number.isFinite(H)) return null;

  // Pull small ruleset and filter in code (there are ~21 docs)
  const rules = await SizeRule.find({}, { scope: 1, minW:1, maxW:1, minWInc:1, maxWInc:1, minB:1, maxB:1, minBInc:1, maxBInc:1, bands: 1 })
                              .lean();

  const scope = rules.find(r => coversWidth(r, W));
  if (!scope) return null;

  const band = pickBand(scope, H);
  return band?.prefix ?? null;
}

module.exports = { sizeToPrefixFromDb };
