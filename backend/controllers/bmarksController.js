// backend/controllers/bmarksController.js

const BMarkf = require('../models/BMarkf');
const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

// Optional: legacy/static mapper; don't crash if missing
let prefixFromSize = null;
try {
  prefixFromSize = require('../utils/prefixFromSize');
} catch (_) {
  /* optional util not present */
}

/* ---------- helpers ---------- */
function toNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* ---------- GET /api/bmarks/preview?prefix=egk ---------- */
exports.previewBMark = async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ error: 'prefix required' });

    const best = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
      .sort({ BMark: 1, rank: 1 })
      .lean();

    return res.json(best || null);
  } catch (e) {
    console.error('[previewBMark]', e);
    return res.status(500).json({ error: 'server error' });
  }
};

/* ---------- GET /api/bmarks/prefix-by-size?BBreite=&BHoehe= ---------- */
exports.prefixBySize = async (req, res) => {
  try {
    const w = toNum(req.query.BBreite);
    const h = toNum(req.query.BHoehe);
    console.log('[prefixBySize] w,h:', w, h);

    const prefix = await sizeToPrefixFromDb(w, h);
    console.log('[prefixBySize] prefix:', prefix);

    return res.json({ prefix });
  } catch (e) {
    console.error('[prefixBySize]', e);
    return res.status(500).json({ error: 'server error' });
  }
};

/* ---------- GET /api/bmarks/preview-by-size?BBreite=&BHoehe= ---------- */
exports.previewBySize = async (req, res) => {
  try {
    const w = toNum(req.query.BBreite);   // accepts "12,5" or "12.5"
    const h = toNum(req.query.BHoehe);
    const prefix = await sizeToPrefixFromDb(w, h);

    console.log('[previewBySize] w,h,prefix:', w, h, prefix);
    if (!prefix) return res.json(null);

    const best = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
      .sort({ BMark: 1, rank: 1 })
      .lean();

    console.log('[previewBySize] best:', best);
    return res.json(best || null);
  } catch (e) {
    console.error('[previewBySize]', e);
    return res.status(500).json({ error: 'server error' });
  }
};

/* ---------- GET /api/bmarks/diag?BBreite=&BHoehe= ---------- */
/* Diagnostics: show inputs, mapped prefix, candidate counts and first pick */
exports.diagBySize = async (req, res) => {
  try {
    const w = toNum(req.query.BBreite);
    const h = toNum(req.query.BHoehe);
    const prefix = await sizeToPrefixFromDb(w, h);

    // optional legacy/static candidates if util exists
    const legacyCandidates = prefixFromSize ? (prefixFromSize(req.query.BBreite, req.query.BHoehe) || []) : [];
    const set = new Set(legacyCandidates);
    if (prefix) set.add(prefix);

    // small convenience: if a candidate ends with 'i', also inspect '<prefix>k'
    for (const p of Array.from(set)) {
      if (/i$/i.test(p)) set.add(`${p}k`);
    }

    const candidates = Array.from(set);
    const poolCounts = {};
    for (const p of candidates) {
      // eslint-disable-next-line no-await-in-loop
      poolCounts[p] = await BMarkf.countDocuments({ BMark: new RegExp(`^${p}`, 'i') });
    }

    let chosen = null;
    for (const p of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const m = await BMarkf.findOne({ BMark: new RegExp(`^${p}`, 'i') })
        .sort({ BMark: 1, rank: 1 })
        .lean();
      if (m) { chosen = m; break; }
    }

    return res.json({
      input: req.query,
      interpreted: { BBreite: w, BHoehe: h },
      mappedPrefix: prefix || null,
      candidates,
      poolCounts,
      chosen: chosen || null,
    });
  } catch (e) {
    console.error('[diagBySize]', e);
    return res.status(500).json({ error: 'server error' });
  }
};

/* ---------- POST /api/bmarks/register  (optional stub) ----------
   NOTE: If you’re using /api/books/register in booksController to assign marks,
   you can delete this stub and its route. Keeping it for backward-compat. */
exports.registerBook = async (req, res) => {
  try {
    const { prefix } = req.body;
    if (!prefix) return res.status(400).json({ error: 'prefix required for stub' });

    const picked = await BMarkf.findOneAndDelete(
      { BMark: new RegExp(`^${prefix}`, 'i') },
      { sort: { BMark: 1, rank: 1 }, new: true }
    ).lean();

    if (!picked) return res.status(409).json({ error: 'no free mark' });
    return res.json({ assigned: picked.BMark });
  } catch (e) {
    console.error('[registerBook]', e);
    return res.status(500).json({ error: 'server error' });
  }
};

/* ---------- PATCH /api/bmarks/:id/release (stub) ---------- */
exports.releaseBMark = async (_req, res) => {
  try {
    // implement if you track reservations; for now: 204
    return res.status(204).end();
  } catch (e) {
    console.error('[releaseBMark]', e);
    return res.status(500).json({ error: 'server error' });
  }
};
