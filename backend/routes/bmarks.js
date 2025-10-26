// backend/routes/bmarks.js
const express = require("express");
const router = express.Router();

const Barcode = require("../models/Barcode");
const { sizeToPrefixFromDb } = require("../utils/sizeToPrefixFromDb");

// --- Legacy controller (kept for other routes only) ---
let ctrl;
try {
  ctrl = require("../controllers/bmarksController");
} catch (e) {
  console.error("[bmarks routes] failed to require controller:", e);
  ctrl = {};
}
console.log("[bmarks routes] exports:", Object.keys(ctrl));
const notImplemented = (name) => (req, res) =>
  res.status(500).json({ error: `bmarksController.${name} is undefined` });

// --- NEW: inline preview-by-size handler (maps width/height -> series, returns 1 candidate) ---
const previewBySizeInline = async (req, res) => {
  try {
    const w = parseFloat(req.query.width ?? req.query.BBreite);
    const h = parseFloat(req.query.height ?? req.query.BHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: "width_and_height_required" });
    }

    const series = await sizeToPrefixFromDb(w, h);
    if (!series) return res.status(422).json({ error: "no_series_for_size" });

    // Tolerant availability in case data isn't normalized to boolean
    const candidate = await Barcode.findOne({
      series,
      $or: [
        { isAvailable: true },
        { isAvailable: 1 },
        { isAvailable: "1" },
        { isAvailable: "true" },
        { isAvailable: { $exists: false } },
        { status: { $in: ["available", "free", null] } },
      ],
    })
      .sort({ rank: 1, code: 1 })
      .select("code -_id")
      .lean();

    return res.json({
      series,
      candidate: candidate?.code ?? null,
    });
  } catch (err) {
    console.error("[bmarks] preview-by-size error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
};

// --- Bind routes ---
// Use our inline handler for preview-by-size
router.get("/preview-by-size", previewBySizeInline);

// Keep the rest using the legacy controller (or stub if missing)
const preview = ctrl.preview || notImplemented("preview");
const validateForSize = ctrl.validateForSize || notImplemented("validateForSize");
const release = ctrl.release || notImplemented("release");

router.get("/preview", preview);
router.get("/validate-for-size", validateForSize);
router.patch("/:id/release", release);

module.exports = router;
