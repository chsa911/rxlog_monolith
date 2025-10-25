// backend/utils/sizeToPrefixFromDb.js
const SizeRule = require("../models/SizeRule");

// Tiny debug so you can see this file is actually loaded
if (!process.env.SILENT_SIZE_DEBUG) {
  console.log("[sizeToPrefixFromDb] using", __filename);
}

function toNum(x) {
  if (typeof x === "number") return x;
  const n = Number(
    String(x ?? "")
      .trim()
      .replace(",", ".")
  );
  return Number.isFinite(n) ? n : NaN;
}

const round1 = x => Math.round(x * 10) / 10;

function widthInRange(w, r) {
  const { minB = null, maxB = null, minBInc = true, maxBInc = true } = r;
  if (minB != null && (minBInc ? w < Number(minB) : w <= Number(minB)))
    return false;
  if (maxB != null && (maxBInc ? w > Number(maxB) : w >= Number(maxB)))
    return false;
  return true;
}

function safeTol() {
  const tParsed = Number(process.env.TOL_CM);
  return Number.isFinite(tParsed) ? tParsed : 0.2; // default 0.2 cm
}

function matchBand(h, b, tol) {
  if (!b) return false;
  const cond = b.condition;
  if (cond === "lt" && b.value != null) return h < Number(b.value) + tol;
  if (cond === "gt" && b.value != null) return h > Number(b.value) - tol;
  if (cond === "eq") {
    const vals = Array.isArray(b.values) ? b.values : [];
    return vals.some(v => Math.abs(h - Number(v)) <= tol);
  }
  return false;
}

async function sizeToPrefixFromDb(widthCm, heightCm) {
  const tol = safeTol();
  const w = round1(toNum(widthCm));
  const h = round1(toNum(heightCm));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;

  const rules = await SizeRule.find({}).lean();

  const matches = rules
    .filter(r => widthInRange(w, r))
    .sort((a, b) => {
      const aSpan = (a.maxB ?? Infinity) - (a.minB ?? -Infinity);
      const bSpan = (b.maxB ?? Infinity) - (b.minB ?? -Infinity);
      return aSpan - bSpan;
    });

  // debug one-liner — comment out later if noisy
  if (!process.env.SILENT_SIZE_DEBUG) {
    console.debug("[sizeToPrefix] w,h,tol", {
      w,
      h,
      tol,
      widthMatches: matches.map(r => ({ minB: r.minB, maxB: r.maxB }))
    });
  }

  for (const rule of matches) {
    const bands = Array.isArray(rule.bands) ? rule.bands : [];
    const eqs = bands.filter(b => b.condition === "eq");
    const others = bands.filter(b => b.condition !== "eq");

    for (const b of eqs) if (matchBand(h, b, tol)) return b.prefix;
    for (const b of others) if (matchBand(h, b, tol)) return b.prefix;
  }

  // Optional: default series fallback (keep current behavior if you want)
  if (process.env.DEFAULT_SERIES) return process.env.DEFAULT_SERIES.trim();

  // Optional: fall back to series with most available
  try {
    const Barcode = require("../models/Barcode");
    const row = await Barcode.aggregate([
      {
        $match: {
          $or: [
            { isAvailable: true },
            { status: { $in: ["free", "available"] } }
          ]
        }
      },
      { $group: { _id: "$series", c: { $sum: 1 } } },
      { $sort: { c: -1, _id: 1 } },
      { $limit: 1 }
    ]);
    if (row?.length) return row[0]._id;
  } catch {}
  return null;
}

module.exports = { sizeToPrefixFromDb };
