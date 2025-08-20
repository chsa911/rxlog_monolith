const BMarkf = require('../models/BMarkf');
const Book = require('../models/Book');
const { sizeToPrefixFromDb } = require('../utils/prefixFromDb');

exports.previewBySize = async (req, res) => {
  const { BBreite, BHoehe } = req.query;
  const prefix = await sizeToPrefixFromDb(BBreite, BHoehe);
  if (!prefix) return res.json(null);

  const best = await BMarkf.findOne({ BMark: new RegExp(`^${prefix}`, 'i') })
    .sort({ rank: 1, BMark: 1 })
    .lean();

  res.json(best || null);
};

exports.registerBook = async (req, res) => {
  const { BBreite, BHoehe, ...fields } = req.body;
  const prefix = await sizeToPrefixFromDb(BBreite, BHoehe);
  if (!prefix) return res.status(400).json({ error: 'no matching size rule' });

  const picked = await BMarkf.findOneAndDelete(
    { BMark: new RegExp(`^${prefix}`, 'i') },
    { sort: { rank: 1, BMark: 1 }, new: true }
  ).lean();
  if (!picked) return res.status(409).json({ error: 'no free BMark for prefix' });

  const doc = await Book.create({
    BBreite: Number(BBreite),
    BHoehe:  Number(BHoehe),
    ...fields,
    BMarkb: picked.BMark
  });
  res.json(doc);
};
