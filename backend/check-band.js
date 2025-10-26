// backend/check-band.js
require("dotenv").config();
const mongoose = require("mongoose");
const SizeRule = require("./models/SizeRule");

// same normalization you use elsewhere: "24,6" -> 24.6
function parseNum(x) {
  const s = String(x ?? "").trim().replace(/\s+/g, "");
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function coversWidth(doc, W) {
  // Prefer new-style scope.W; fall back to legacy minW/minB
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
  const min = doc.minW ?? doc.minB ?? -Infinity;
  const max = doc.maxW ?? doc.maxB ?? Infinity;
  const minInc = (doc.minWInc ?? doc.minBInc) !== false;
  const maxInc = (doc.maxWInc ?? doc.maxBInc) !== false;
  const lowerOk = minInc ? W >= min : W > min;
  const upperOk = maxInc ? W <= max : W < max;
  return lowerOk && upperOk;
}

// Option-1 band resolution:
// 1) exact heights win (eq.values includes H)
// 2) else if H ≤ lt.value  => lt (bottom)
// 3) else                  => gt (top)
function pickBand(scope, H) {
  const bands = Array.isArray(scope.bands) ? scope.bands : [];

  // eq first
  for (const b of bands) {
    if (b?.condition === "eq" && Array.isArray(b.values) && b.values.includes(H)) {
      return { band: b, reason: "eq" };
    }
  }

  const lt = bands.find(b => b?.condition === "lt" && typeof b.value === "number");
  const gt = bands.find(b => b?.condition === "gt" && typeof b.value === "number");
  if (!lt && !gt) return { band: null, reason: "no-lt-gt" };

  const T = lt?.value ?? gt?.value;
  if (lt && H <= T) return { band: lt, reason: "H<=T → lt" };
  if (gt) return { band: gt, reason: "H>T  → gt" };
  return { band: null, reason: "no-match" };
}

(async () => {
  try {
    const rawW = process.argv[2];
    const rawH = process.argv[3];
    const W = parseNum(rawW);
    const H = parseNum(rawH);

    if (!Number.isFinite(W) || !Number.isFinite(H)) {
      console.error("Usage: node backend/check-band.js <width> <height>");
      console.error("Example: node backend/check-band.js 24,6 33");
      process.exit(2);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const rules = await SizeRule.find(
      {},
      {
        scope: 1,
        minW: 1, maxW: 1, minWInc: 1, maxWInc: 1,
        minB: 1, maxB: 1, minBInc: 1, maxBInc: 1,
        bands: 1
      }
    ).lean();

    const scope = rules.find(r => coversWidth(r, W));
    if (!scope) {
      console.log(JSON.stringify({ input: { W, H }, match: null, reason: "no-scope" }, null, 2));
      await mongoose.disconnect();
      process.exit(0);
    }

    const { band, reason } = pickBand(scope, H);

    // build a readable summary
    const sw = scope.scope?.W;
    const bounds = sw
      ? { min: sw.min, minInclusive: sw.minInclusive !== false, max: sw.max, maxInclusive: sw.maxInclusive !== false }
      : {
          min: scope.minW ?? scope.minB,
          minInclusive: (scope.minWInc ?? scope.minBInc) !== false,
          max: scope.maxW ?? scope.maxB,
          maxInclusive: (scope.maxWInc ?? scope.maxBInc) !== false,
        };

    const T = (scope.bands.find(b => b.condition === "lt") || scope.bands.find(b => b.condition === "gt"))?.value ?? null;
    const exacts = scope.bands.filter(b => b.condition === "eq").flatMap(b => b.values || []).sort((a,b)=>a-b);

    const out = {
      input: { W, H },
      scope: {
        bounds,
        threshold: T,
        exactHeights: exacts
      },
      decision: band
        ? {
            reason,
            condition: band.condition,
            value: band.value ?? null,
            prefix: band.prefix ?? null,
            position: band.position ?? null
          }
        : { reason, prefix: null }
    };

    console.log(JSON.stringify(out, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err && (err.stack || err.message || err));
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
