// backend/utils/sizeToPrefix.js

// Rules table provided by you
const sizeRules = [
  { maxB: 10.5, hCodes: { lt: "egk", mid: "lgk", gt: "ogk" } },
  { maxB: 11,   hCodes: { lt: "eak", mid: "lak", gt: "oak" } },
  { maxB: 11.4, hCodes: { lt: "ekb" } },
  { maxB: 11.5, hCodes: { lt: "eb",  mid: "lb",  gt: "ob" } },
  { maxB: 11.9, hCodes: { lt: "ekg" } },
  { maxB: 12,   hCodes: { lt: "es",  mid: "ls",  gt: "os" } },
  { maxB: 12.4, hCodes: { lt: "eki" } },
  { maxB: 12.5, hCodes: { lt: "ei",  mid: "li",  gt: "oi" } },
  { maxB: 13,   hCodes: { lt: "ek",  mid: "lk",  gt: "ok" } },
  { maxB: 13.4, hCodes: { lt: "ekn" } },
  { maxB: 13.5, hCodes: { lt: "en",  mid: "ln",  gt: "ogk" } },
  { maxB: 14,   hCodes: { lt: "egk", mid: "lgk", gt: "ogk" } },
  { maxB: 14.5, hCodes: { lt: "ep",  mid: "lp",  gt: "op" } },
  { maxB: 15,   hCodes: { lt: "eg",  mid: "lg",  gt: "og" } },
  { maxB: 15.5, hCodes: { lt: "epk", mid: "lpk", gt: "opk" } },
  { maxB: 17.3, hCodes: { lt: "ekt" } },
  { maxB: 17.5, hCodes: { lt: "et",  mid: "lt",  gt: "ot" } },
  { maxB: 22.5, hCodes: { lt: "etk", mid: "ltk", gt: "otk" } },
  { maxB: 24,   hCodes: { lt: "eu",  mid: "lu",  gt: "ou" } },
  { maxB: 24.5, hCodes: { lt: "euk", mid: "luk", gt: "ouk" } },
  { maxB: 27,   hCodes: { lt: "eyk", mid: "lyk", gt: "oyk" } },
];

// List of “mid” heights you mentioned, compare with epsilon
const MID_HEIGHTS = [20.5, 21, 21.5];
const EPS = 0.06; // tolerance for float comparisons (±0.06 cm)

function isMidHeight(h) {
  return MID_HEIGHTS.some(x => Math.abs(h - x) <= EPS);
}

// Approx mid threshold for lt/gt decision
function getMidHeight(maxB) {
  if (maxB <= 11)   return 18;
  if (maxB <= 12.5) return 19;
  if (maxB <= 13.5) return 20.5;
  if (maxB <= 15.5) return 22;
  if (maxB <= 17.5) return 23;
  if (maxB <= 22.5) return 23;
  if (maxB <= 24)   return 28;
  if (maxB <= 24.5) return 29;
  return 32;
}

// i → ik fallback (prefix layer). If you only want "ei"→"eik", keep that rule.
function normalizeI(prefix) {
  // If ends with lone "i", convert to "...ik"
  return /i$/.test(prefix) ? `${prefix}k` : prefix;
}

/**
 * Compute prefix (e.g. "egk", "lgk", "ogk") from width/height
 * @param {number|string} BBreite
 * @param {number|string} BHoehe
 * @returns {string|null}
 */
function sizeToPrefix(BBreite, BHoehe) {
  const w = Number(BBreite);
  const h = Number(BHoehe);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;

  // Optional rounding to 1 decimal to mimic your input style
  const B = Math.round(w * 10) / 10;
  const H = Math.round(h * 10) / 10;

  for (const { maxB, hCodes } of sizeRules) {
    if (B <= maxB) {
      const midThresh = getMidHeight(maxB);
      // Pick by height bucket
      if ('mid' in hCodes && isMidHeight(H)) return normalizeI(hCodes.mid);
      if ('lt'  in hCodes && H <  midThresh) return normalizeI(hCodes.lt);
      if ('gt'  in hCodes && H >  midThresh) return normalizeI(hCodes.gt);
      // Fallback to any available in priority order
      const any = hCodes.lt || hCodes.mid || hCodes.gt;
      return any ? normalizeI(any) : null;
    }
  }
  return null;
}

module.exports = { sizeToPrefix, sizeRules };
