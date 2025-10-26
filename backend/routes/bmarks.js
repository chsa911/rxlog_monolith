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
const notImplemented =
  (name) =>
  (req, res) =>
    res.status(500).json({ error: `bmarksController.${name} is undefined` });

// --- helpers ---
const normalizeNumber = (v) => {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace?.(",", ".").trim());
  return parseFloat(v);
};
const cleanSeries = (p) => (typeof p === "string" ? p.trim().toLowerCase() : p);
const fallbackItoIK = (p) => {
  if (typeof p !== "string") return null;
  const s = p.trim().toLowerCase();
  return s.endsWith("i") ? s + "k" : null;
};
const pickCode = (doc) => (doc ? doc.code || doc.barcode || doc.value || null : null);

const availabilityFilter = {
  $or: [
    { isAvailable: true },
    { isAvailable: 1 },
    { isAvailable: "1" },
    { isAvailable: "true" },
    { isAvailable: { $exists: false } },
    { status: { $in: ["available", "free", null] } },
  ],
};

async function findCandidateForSeries(series) {
  const q = { series, ...availabilityFilter };
  const count = await Barcode.countDocuments(q);
  if (count === 0) return { count: 0, doc: null };
  const doc = await Barcode.findOne(q)
    .sort({ rank: 1, code: 1 })
    .select({ code: 1, barcode: 1, value: 1, _id: 0 })
    .lean();
  return { count, doc };
}

// --- NEW: inline preview-by-size handler (maps width/height -> series, returns 1 candidate) ---
const previewBySizeInline = async (req, res) => {
  try {
    const w = normalizeNumber(req.query.width ?? req.query.BBreite);
    const h = normalizeNumber(req.query.height ?? req.query.BHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ error: "width_and_height_required" });
    }

    let baseSeries = await sizeToPrefixFromDb(w, h);
    if (!baseSeries) {
      return res.status(422).json({ error: "no_series_for_size" });
    }
    baseSeries = cleanSeries(baseSeries);

    // Prefer-IK toggle (optional via query or env)
    const preferIK =
      req.query.preferIK === "1" ||
      req.query.preferIK === "true" ||
      process.env.BM_PREFER_IK === "true";

    let usedSeries = baseSeries;
    let candidateDoc = null;

    // If preferIK and base ends with 'i', try IK first
    let triedIkFirst = false;
    const ikSeries = fallbackItoIK(baseSeries);
    let ikFirstAvailableCount = 0;
    if (preferIK && ikSeries) {
      const r = await findCandidateForSeries(ikSeries);
      ikFirstAvailableCount = r.count;
      if (r.doc) {
        candidateDoc = r.doc;
        usedSeries = ikSeries;
        triedIkFirst = true;
      }
    }

    // Try primary base series (unless IK already chosen)
    let primaryAvailableCount = 0;
    if (!candidateDoc) {
      const r = await findCandidateForSeries(baseSeries);
      primaryAvailableCount = r.count;
      if (r.doc) {
        candidateDoc = r.doc;
        usedSeries = baseSeries;
      }
    }

    // Classic fallback: if none yet and base ends with 'i', try IK
    let fallbackApplied = false;
    let fallbackSeries = null;
    let fallbackAvailableCount = 0;
    if (!candidateDoc && !triedIkFirst && ikSeries) {
      fallbackSeries = ikSeries;
      const r = await findCandidateForSeries(ikSeries);
      fallbackAvailableCount = r.count;
      if (r.doc) {
        candidateDoc = r.doc;
        usedSeries = ikSeries;
        fallbackApplied = true;
      }
    }

    const payload = {
      series: usedSeries,
      candidate: pickCode(candidateDoc),
      fallbackApplied,
    };

    // Optional debug
    const wantDebug =
      req.query.debug === "1" || req.query.debug === "true" || req.query.debug === "yes";
    if (wantDebug) {
      payload.debug = {
        requestedWidth: w,
        requestedHeight: h,
        primarySeries: baseSeries,
        primaryAvailableCount,
        preferIK,
        triedIkFirst,
        ikSeries,
        ikFirstAvailableCount,
        fallbackSeries,
        fallbackAvailableCount,
      };
    }

    return res.json(payload);
  } catch (err) {
    console.error("[bmarks] preview-by-size error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
};

// --- Bind routes ---
router.get("/preview-by-size", previewBySizeInline);

// Legacy endpoints if controller exists
const preview = ctrl.preview || notImplemented("preview");
const validateForSize = ctrl.validateForSize || notImplemented("validateForSize");
const release = ctrl.release || notImplemented("release");

router.get("/preview", preview);
router.get("/validate-for-size", validateForSize);
router.patch("/:id/release", release);

module.exports = router;
