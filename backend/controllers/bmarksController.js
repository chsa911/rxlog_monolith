// backend/controllers/bmarksController.js
const BMarkf = require('../models/BMarkf');
const prefixFromSize = require('../utils/prefixFromSize'); // if you have it

// plain prefix preview: GET /api/bmarks/preview?prefix=egk
exports.previewBMark = async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ error: 'prefix required' });
    const doc = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
      .sort({ rank: 1, BMark: 1 })
      .lean();
    res.json(doc || null);
  } catch (e) {
    console.error('[previewBMark]', e);
    res.status(500).json({ error: 'server error' });
  }
};

/// controllers/bmarksController.js
 // controllers/bmarksController.js
 const { sizeToPrefixFromDb } = require('../utils/sizeToPrefixFromDb');

 exports.previewBySize = async (req, res) => {
   const w = req.query.BBreite;   // can be "12,5" or "12.5"
   const h = req.query.BHoehe;
   const prefix = await sizeToPrefixFromDb(w, h);
   if (!prefix) return res.json(null);

   const BMarkf = require('../models/BMarkf');
   const best = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
     .sort({ BMark: 1, rank: 1 })   // with index {BMark:1,rank:1} this is index-friendly
     .lean();

   res.json(best || null);
 };

// diagnostics: GET /api/bmarks/diag?BBreite=&BHoehe=
exports.diagBySize = async (req, res) => {
  try {
    const toNum = v => (v == null ? null : Number(String(v).replace(',', '.')));
    const wIn = toNum(req.query.BBreite);
    const hIn = toNum(req.query.BHoehe);
    const wcm = wIn != null ? (wIn > 50 ? wIn / 10 : wIn) : null;
    const hcm = hIn != null ? (hIn > 50 ? hIn / 10 : hIn) : null;

    const candidates = prefixFromSize ? (prefixFromSize(req.query.BBreite, req.query.BHoehe) || []) : [];
    const counts = {};
    for (const p of candidates) {
      counts[p] = await BMarkf.countDocuments({ BMark: new RegExp(`^${p}`, 'i') });
    }
    let chosen = null;
    for (const p of candidates) {
      const m = await BMarkf.findOne({ BMark: new RegExp(`^${p}`, 'i') })
        .sort({ rank: 1, BMark: 1 }).lean();
      if (m) { chosen = m; break; }
    }
    res.json({ input: req.query, interpreted: { wcm, hcm }, candidates, poolCounts: counts, chosen });
  } catch (e) {
    console.error('[diagBySize]', e);
    res.status(500).json({ error: 'server error' });
  }
};

// POST /api/bmarks/register
exports.registerBook = async (req, res) => {
  try {
    // stub: just consume a mark by explicit prefix for now
    const { prefix } = req.body;
    if (!prefix) return res.status(400).json({ error: 'prefix required for stub' });
    const picked = await BMarkf.findOneAndDelete(
      { BMark: new RegExp(`^${prefix}`, 'i') },
      { sort: { rank: 1, BMark: 1 }, new: true }
    ).lean();
    if (!picked) return res.status(409).json({ error: 'no free mark' });
    res.json({ assigned: picked.BMark });
  } catch (e) {
    console.error('[registerBook]', e);
    res.status(500).json({ error: 'server error' });
  }
};

// PATCH /api/bmarks/:id/release  (stub)
exports.releaseBMark = async (req, res) => {
  try {
    // implement if you have a release flow; for now respond 204
    res.status(204).end();
  } catch (e) {
    console.error('[releaseBMark]', e);
    res.status(500).json({ error: 'server error' });
  }
};
