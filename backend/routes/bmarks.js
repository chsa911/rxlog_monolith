const express = require("express");
const router = express.Router();

// Be explicit about the path & file name:
let ctrl;
try {
  ctrl = require("../controllers/bmarksController"); // ../controllers/bmarksController.js
} catch (e) {
  console.error("[bmarks routes] failed to require controller:", e);
  ctrl = {};
}

// Log available exports once on boot
console.log("[bmarks routes] exports:", Object.keys(ctrl));

// Fallback no-op handler to avoid "Route.get() requires a callback" crash
const notImplemented = name => (req, res) => {
  res.status(500).json({ error: `bmarksController.${name} is undefined` });
};

// Bind routes safely
const previewBySize = ctrl.previewBySize || notImplemented("previewBySize");
const preview = ctrl.preview || notImplemented("preview");
const validateForSize =
  ctrl.validateForSize || notImplemented("validateForSize");
const release = ctrl.release || notImplemented("release");

// Routes (assumes this router is mounted at /api/bmarks)
router.get("/preview-by-size", previewBySize);
router.get("/preview", preview);
router.get("/validate-for-size", validateForSize);
router.patch("/:id/release", release);

module.exports = router;
