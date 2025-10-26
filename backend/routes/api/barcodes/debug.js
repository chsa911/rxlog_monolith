// backend/routes/api/barcodes/debug.js
const express = require("express");
const router = express.Router();
const Barcode = require("../../../models/Barcode");

router.get("/debug-availability", async (req, res) => {
  const series = String(req.query.series || "").toLowerCase();
  const total = await Barcode.countDocuments({ series });
  const free  = await Barcode.countDocuments({ series, isAvailable: true });
  const sample = await Barcode.find({ series }).sort({ rank: 1, code: 1 })
    .limit(3).select("code isAvailable status series -_id").lean();
  res.json({ series, total, free, sample });
});

module.exports = router;
