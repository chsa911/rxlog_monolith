// backend/routes/api/barcodes/previewBarcode.js
const express = require("express");
const router = express.Router();

const Barcode = require("../../../models/Barcode");
const Book = require("../../../models/Book");
const { sizeToPrefixFromDb: sizeToSeriesFromDb } =
  require("../../../utils/sizeToPrefixFromDb");

// Escape a string for use in RegExp
const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Treat “available” broadly to cover legacy data shapes
function availableMatch() {
  return {
    $or: [
      { isAvailable: true },
      { isAvailable: 1 },
      { isAvailable: "1" },
      { isAvailable: "true" },
      { isAvailable: { $exists: false } }, // missing => treat as available
      { status: { $in: ["available", "free", null] } },
    ],
  };
}

/**
 * GET /api/barcodes/preview-barcode?width=...&height=...
 * Also accepts German params: ?BBreite=...&BHoehe=...
 *
 * Returns:
 * { series: "<series>", candidate: "<code>|null", availableCount: <number> }
 */
router.get("/preview-barcode", async (req, res) => {
  try {
    // Accept either width/height or BBreite/BHoehe
    const w = parseFloat(req.query.width ?? req.query.BBreite);
    const h = parseFloat(req.query.height ?? req.query.BHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: "width_and_height_required" });
    }

    // Map dimensions -> series via your size rules
    const series = await sizeToSeriesFromDb(w, h);
    if (!series) return res.status(422).json({ error: "no_series_for_size" });

    const seriesRx = new RegExp(`^${escapeRx(series)}$`, "i");

    // Pick one lowest-rank available code, excluding any already used in Books
    const pick = await Barcode.aggregate([
      { $match: { series: seriesRx, ...availableMatch() } },
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
                    { $eq: ["$BMark",  "$$c"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "uses",
        },
      },
      { $match: { uses: { $size: 0 } } },
      { $sort: { rank: 1, code: 1 } },   // rank first, then code
      { $project: { _id: 0, code: 1 } },
      { $limit: 1 },
    ]);

    const candidate = pick[0]?.code ?? null;

    // Optional: availability count for UI messaging
    const counts = await Barcode.aggregate([
      { $match: { series: seriesRx, ...availableMatch() } },
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
                    { $eq: ["$BMark",  "$$c"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "uses",
        },
      },
      { $match: { uses: { $size: 0 } } },
      { $count: "available" },
    ]);
    const availableCount = counts[0]?.available ?? 0;

    return res.json({ series, candidate, availableCount });
  } catch (err) {
    console.error("api/barcodes/preview-barcode error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

module.exports = router;
