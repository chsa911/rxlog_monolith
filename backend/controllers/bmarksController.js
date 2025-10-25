// backend/controllers/bmarksController.js
const Barcode = require("../models/Barcode");
const Book = require("../models/Book");
const { sizeToPrefixFromDb } = require("../utils/sizeToPrefixFromDb");

/* ------------------------- helpers ------------------------- */
function toNumberLoose(x) {
  if (typeof x === "number") return x;
  if (typeof x !== "string") return NaN;
  const s = x
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const escapeRx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Aggregate available barcodes for a given series, excluding codes referenced by books.
 * Returns { items: [{BMark, rank}...], available: <int> }
 */
async function aggregateSeriesPreview(series, limit = 30) {
  const seriesRx = new RegExp(`^${escapeRx(series)}$`, "i");

  // main list (first N items)
  const list = await Barcode.aggregate([
    {
      $match: {
        series: seriesRx,
        $or: [{ isAvailable: true }, { status: { $in: ["free", "available"] } }]
      }
    },
    // Exclude codes already referenced by a book (BMarkb, barcode, or legacy BMark)
    {
      $lookup: {
        from: "books",
        let: { c: "$code" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$BMarkb", "$$c"] },
                  { $eq: ["$barcode", "$$c"] },
                  { $eq: ["$BMark", "$$c"] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "uses"
      }
    },
    { $match: { uses: { $size: 0 } } },
    { $sort: { rank: 1, triplet: 1, code: 1 } },
    { $limit: Math.max(1, Math.min(200, limit)) },
    { $project: { _id: 0, BMark: "$code", rank: { $ifNull: ["$rank", 0] } } }
  ]);

  // count total available for the series (excluding used)
  const countAgg = await Barcode.aggregate([
    {
      $match: {
        series: seriesRx,
        $or: [{ isAvailable: true }, { status: { $in: ["free", "available"] } }]
      }
    },
    {
      $lookup: {
        from: "books",
        let: { c: "$code" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$BMarkb", "$$c"] },
                  { $eq: ["$barcode", "$$c"] },
                  { $eq: ["$BMark", "$$c"] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "uses"
      }
    },
    { $match: { uses: { $size: 0 } } },
    { $count: "available" }
  ]);

  const available = countAgg.length ? countAgg[0].available : 0;
  return { items: list, available };
}

/**
 * If a series ends in plain 'i' (e.g., ei, li, oi), fall back to 'ik' (eik, lik, oik).
 * Returns the fallback series string or null if not applicable.
 */
function fallbackItoIK(prefix) {
  const m = /^(e|l|o)(.+)$/i.exec(prefix || "");
  if (!m) return null;
  const pos = m[1];
  const colour = m[2];
  if (colour.endsWith("ik")) return null; // already an 'ik' series
  if (!colour.endsWith("i")) return null; // only fallback when plain 'i'
  return `${pos}${colour}k`;
}

/* ========================= GET /api/bmarks/preview-by-size =========================
   Query: ?BBreite=..&BHoehe=..
   Returns: { prefix, items: [{BMark, rank}...], available }
============================================================================= */
async function previewBySize(req, res) {
  try {
    const rawBreite = req.query.BBreite ?? req.query.width ?? req.query.breite;
    const rawHoehe = req.query.BHoehe ?? req.query.height ?? req.query.hoehe;

    const w = toNumberLoose(rawBreite);
    const h = toNumberLoose(rawHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({
        error: "Invalid dimensions",
        BBreite: rawBreite,
        BHoehe: rawHoehe
      });
    }

    let prefix;
    try {
      prefix = await sizeToPrefixFromDb(w, h);
    } catch (e) {
      console.error("[preview-by-size] sizeToPrefixFromDb failed:", e);
      return res
        .status(500)
        .json({ error: "Size mapping error", message: e.message });
    }

    // No match at all → graceful empty response
    if (!prefix) {
      return res.json({ prefix: null, items: [], available: 0 });
    }

    // Try primary series
    let { items, available } = await aggregateSeriesPreview(prefix, 30);

    // Fallback rule: if primary ends with plain 'i' and has no stock, try the 'ik' variant
    if (available === 0) {
      const altSeries = fallbackItoIK(prefix);
      if (altSeries) {
        const alt = await aggregateSeriesPreview(altSeries, 30);
        if (alt.available > 0) {
          return res.json({
            prefix: altSeries,
            items: alt.items,
            available: alt.available
          });
        }
      }
    }

    // Return primary (even if empty – clients may still want the prefix hint)
    return res.json({ prefix, items, available });
  } catch (err) {
    console.error(
      "[preview-by-size] error:",
      err && (err.stack || err.message || err)
    );
    res.status(500).json({ error: "Server error" });
  }
}

/* ========================= GET /api/bmarks/preview =========================
   Optional query: ?series=ei (or any)
   - With series: returns { series, items, available }
   - Without series: returns [{ series, available }] overview across all series
============================================================================= */
async function preview(req, res) {
  try {
    const { series } = req.query;

    if (series) {
      const { items, available } = await aggregateSeriesPreview(series, 50);
      return res.json({ series, items, available });
    }

    // Overview: available counts per series (excluding codes referenced by books)
    const usedCodes = new Set([
      ...(await Book.distinct("BMarkb", {
        BMarkb: { $type: "string", $ne: "" }
      })),
      ...(await Book.distinct("barcode", {
        barcode: { $type: "string", $ne: "" }
      })),
      ...(await Book.distinct("BMark", { BMark: { $type: "string", $ne: "" } }))
    ]);

    const rows = await Barcode.aggregate([
      {
        $match: {
          $or: [
            { isAvailable: true },
            { status: { $in: ["free", "available"] } }
          ],
          code: { $nin: Array.from(usedCodes) }
        }
      },
      { $group: { _id: "$series", available: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    return res.json(rows.map(r => ({ series: r._id, available: r.available })));
  } catch (err) {
    console.error("[preview] error:", err && (err.stack || err.message || err));
    res.status(500).json({ error: "Server error" });
  }
}

/* ========================= GET /api/bmarks/validate-for-size =========================
   Query: ?BBreite=..&BHoehe=..&code=eik202
   NEW behavior:
   - Accepts fallback series (ei → eik) when size maps to an 'i' series
   - If code doesn't exist in pool, returns ok:true + creatable:true
   - Adds matchedSeries (actual input series) and allowed (accepted series)
============================================================================= */
async function validateForSize(req, res) {
  try {
    const rawBreite = req.query.BBreite ?? req.query.width ?? req.query.breite;
    const rawHoehe = req.query.BHoehe ?? req.query.height ?? req.query.hoehe;
    const codeRaw = (
      req.query.code ??
      req.query.BMark ??
      req.query.BMarkb ??
      req.query.barcode ??
      ""
    )
      .toString()
      .trim();

    const w = toNumberLoose(rawBreite);
    const h = toNumberLoose(rawHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({
        ok: false,
        reason: "Invalid dimensions",
        BBreite: rawBreite,
        BHoehe: rawHoehe
      });
    }
    if (!codeRaw) {
      return res.status(400).json({ ok: false, reason: "Missing code" });
    }

    const prefix = await sizeToPrefixFromDb(w, h);
    if (!prefix) {
      return res
        .status(409)
        .json({ ok: false, reason: "No matching size rule" });
    }

    const alt = fallbackItoIK(prefix); // e.g. "ei" -> "eik" or null
    const allowed = [prefix].concat(alt ? [alt] : []);

    // Parse "<series><digits>"
    const m = codeRaw.match(/^([a-z]+)(\d+)$/i);
    if (!m) {
      return res.status(400).json({
        ok: false,
        reason: `Code must be <series><digits>, e.g. ${prefix}001`,
        expectedSeries: prefix,
        allowed
      });
    }
    const inputSeries = m[1].toLowerCase();
    const numberPart = m[2];

    // Series must be either expected or allowed fallback
    if (!allowed.includes(inputSeries)) {
      return res.status(400).json({
        ok: false,
        reason: `Code does not match series ${prefix}`,
        expectedSeries: prefix,
        allowed
      });
    }

    const normalized = (inputSeries + numberPart).toLowerCase();
    const codeRx = new RegExp(`^${escapeRx(normalized)}$`, "i");

    // Ensure not already used by any Book field (case-insensitive)
    const inUse = await Book.exists({
      $or: [{ BMarkb: codeRx }, { barcode: codeRx }, { BMark: codeRx }]
    });
    if (inUse) {
      return res
        .status(409)
        .json({ ok: false, reason: "Code already used by a book" });
    }

    // Check pool for EXACT code (series is encoded in the code itself)
    const bc = await Barcode.findOne({ code: codeRx }).lean();

    if (!bc) {
      // Not in pool → allow creation (especially useful for fallback like eik404)
      return res.json({
        ok: true,
        series: prefix, // keep legacy behavior: expected series
        matchedSeries: inputSeries, // new: the actual series of the input code
        code: normalized,
        exists: false,
        available: true,
        creatable: true,
        allowed
      });
    }

    const isAvailable =
      bc.isAvailable === true ||
      ["free", "available"].includes(String(bc.status || "").toLowerCase());

    if (!isAvailable) {
      return res.status(409).json({
        ok: false,
        reason: "Code not available",
        matchedSeries: inputSeries
      });
    }

    return res.json({
      ok: true,
      series: prefix, // expected series from size
      matchedSeries: inputSeries, // actual input series ("ei" or "eik")
      code: bc.code,
      exists: true,
      available: true,
      creatable: false,
      allowed
    });
  } catch (err) {
    console.error(
      "[validate-for-size] error:",
      err && (err.stack || err.message || err)
    );
    res.status(500).json({ ok: false, reason: "Server error" });
  }
}

/* ========================= PATCH /api/bmarks/:id/release =========================
   :id can be a full code (e.g., "egk001") or a Mongo _id.
   Marks barcode back to available. Does NOT touch books.
============================================================================= */
async function release(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id or code required" });

    const match = /^[0-9a-f]{24}$/i.test(id)
      ? { _id: id }
      : { code: new RegExp(`^${escapeRx(id)}$`, "i") }; // case-insensitive code match

    const result = await Barcode.updateOne(match, {
      $set: {
        isAvailable: true,
        status: "available",
        reservedAt: null,
        assignedBookId: null
      }
    });

    if (result.matchedCount === 0 && result.modifiedCount === 0) {
      return res.status(404).json({ error: "Barcode not found" });
    }
    return res.status(204).end();
  } catch (err) {
    console.error("[release] error:", err && (err.stack || err.message || err));
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  previewBySize,
  preview,
  validateForSize,
  release
};
