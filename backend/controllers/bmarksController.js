    // backend/controllers/bmarksController.js
    const Book = require('../models/Book');
    const BMarkf = require('../models/BMarkf');
    const { computeRank } = require('../utils/status');

    // Helper to derive prefix from size (your rules go here)
    function derivePrefix(BBreite, BHoehe) {
      if (BBreite < 12 && BHoehe < 20) return 'egk';
      if (BBreite < 20) return 'lgk';
      return 'ogk';
    }
    /**
     * Preview best available mark for a given prefix
     */
    exports.previewBMark = async (req, res) => {
      const { prefix } = req.query; // e.g. "egk"
      if (!prefix) return res.status(400).json({ error: 'prefix required' });

      const candidate = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
        .sort({ rank: 1, BMark: 1 });
      if (!candidate) return res.json(null);
      res.json(candidate);
    };
exports.previewBySize = async (req, res) => {
  try {
    const { BBreite, BHoehe } = req.query;
    if (!BBreite || !BHoehe) {
      return res.status(400).json({ error: 'BBreite and BHoehe required' });
    }

    const prefix = derivePrefix(Number(BBreite), Number(BHoehe));

    const candidate = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
      .sort({ rank: 1, BMark: 1 });

    res.json(candidate || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

    /**
     * Register book: allocate mark
     */
    exports.registerBook = async (req, res) => {
      const { BBreite, BHoehe, ...fields } = req.body;

      // derive prefix from BBreite, BHoehe (your rules)
      const prefix = derivePrefix(BBreite, BHoehe); // implement rules in utils

exports.previewBySize = async (req, res) => {
  const { BBreite, BHoehe } = req.query;
  if (!BBreite || !BHoehe) return res.status(400).json({ error: 'BBreite and BHoehe required' });

  const prefix = derivePrefix(Number(BBreite), Number(BHoehe)); // same logic you use client-side
  const candidate = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
    .sort({ rank: 1, BMark: 1 });
  res.json(candidate || null);
};


      const candidate = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
        .sort({ rank: 1, BMark: 1 });

      if (!candidate) return res.status(409).json({ error: 'no mark available' });

      const book = await Book.create({ BBreite, BHoehe, ...fields, BMarkb: candidate.BMark });

      await BMarkf.deleteOne({ _id: candidate._id });

      res.json(book);
    };

    /**
     * Release BMark manually
     */
    exports.releaseBMark = async (req, res) => {
      const { id } = req.params;
      const book = await Book.findById(id);
      if (!book || !book.BMarkb) return res.status(404).json({ error: 'no mark to release' });

      const code = book.BMarkb;
      const barcode = code.slice(3);
      const rank = computeRank(barcode);

      await BMarkf.updateOne(
        { BMark: code },
        { $setOnInsert: { BMark: code, rank } },
        { upsert: true }
      );

      book.BMarkb = null;
      await book.save();

      res.json({ success: true });
    };

    /* Dummy placeholder: implement your size-table rules */
    function derivePrefix(BBreite, BHoehe) {
      // e.g. if BBreite < 12 => "egk"
      // else if ... => "lgk"
      return "egk";
    }
