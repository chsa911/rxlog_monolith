// backend/controllers/booksController.js
const Book = require('../models/Book');
const BMarkf = require('../models/BMarkf');
const { getStatus, computeRank } = require('../utils/status');

/**
 * List books with pagination, sort, search, filters
 */
exports.listBooks = async (req, res) => {
  const { q, page = 1, limit = 20, sortBy = 'BEind', sortDir = 'desc',
          bmark, seiten, seitenMin, seitenMax, status, topOnly, since } = req.query;

  const filter = {};

  if (q) {
    filter.$or = [
      { BAutor:   { $regex: q, $options: 'i' } },
      { BKw:      { $regex: q, $options: 'i' } },
      { BVerlag:  { $regex: q, $options: 'i' } },
      { BMarkb:   { $regex: q, $options: 'i' } },
    ];
  }

  if (bmark) filter.BMarkb = { $regex: bmark, $options: 'i' };
  if (seiten) filter.BSeiten = Number(seiten);
  if (seitenMin || seitenMax) {
    filter.BSeiten = {};
    if (seitenMin) filter.BSeiten.$gte = Number(seitenMin);
    if (seitenMax) filter.BSeiten.$lte = Number(seitenMax);
  }

  if (status) {
    if (status === 'historisiert') filter.BHistorisiert = true;
    if (status === 'vorzeitig') filter.BVorzeitig = true;
    if (status === 'open') { filter.BHistorisiert = false; filter.BVorzeitig = false; }
  }
  if (topOnly === 'true') filter.BTop = true;

  if (since) {
    const sinceDate = new Date(since);
    filter.$or = [
      { BTopAt: { $gte: sinceDate } },
      { BHistorisiertAt: { $gte: sinceDate } },
      { BVorzeitigAt: { $gte: sinceDate } },
    ];
  }

  const skip = (page - 1) * limit;
  const total = await Book.countDocuments(filter);
  const items = await Book.find(filter)
    .sort({ [sortBy]: sortDir === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(Number(limit));

  res.json({
    page: Number(page),
    pages: Math.ceil(total / limit),
    total,
    items: items.map(b => ({ ...b.toObject(), status: getStatus(b) })),
  });
};

/**
 * Autocomplete for BAutor, BKw, BVerlag
 */
exports.autocomplete = async (req, res) => {
  const { field } = req.params;
  const { q = '' } = req.query;
  if (!['BAutor','BKw','BVerlag'].includes(field)) {
    return res.status(400).json({ error: 'Invalid field' });
  }
  const docs = await Book.find(
    { [field]: { $regex: q, $options: 'i' } },
    { [field]: 1 }
  ).limit(10).lean();
  const values = [...new Set(docs.map(d => d[field]))];
  res.json(values);
};

/**
 * Toggle Top
 */
exports.setTop = async (req, res) => {
  const { id } = req.params;
  const { top } = req.body;
  if (typeof top !== 'boolean') return res.status(400).json({ error: 'top must be boolean' });

  const update = top ? { BTop: true, BTopAt: new Date() } : { BTop: false, BTopAt: null };
  const doc = await Book.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Book not found' });
  res.json({ ...doc.toObject(), status: getStatus(doc) });
};

/**
 * Set Historisiert / Vorzeitig / Open
 */
exports.setStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['historisiert','vorzeitig','open'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }

  const book = await Book.findById(id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  if (['historisiert','vorzeitig'].includes(status) && book.BMarkb) {
    const barcode = book.BMarkb.slice(3);
    const rank = computeRank(barcode);
    await BMarkf.updateOne(
      { BMark: book.BMarkb },
      { $setOnInsert: { BMark: book.BMarkb, rank } },
      { upsert: true }
    );
    book.BMarkb = null;
  }

  const now = new Date();
  if (status === 'historisiert') {
    book.BHistorisiert = true;
    book.BHistorisiertAt = now;
    book.BVorzeitig = false; book.BVorzeitigAt = null;
  } else if (status === 'vorzeitig') {
    book.BVorzeitig = true;
    book.BVorzeitigAt = now;
    book.BHistorisiert = false; book.BHistorisiertAt = null;
  } else {
    book.BHistorisiert = false; book.BHistorisiertAt = null;
    book.BVorzeitig = false; book.BVorzeitigAt = null;
  }

  await book.save();
  res.json({ ...book.toObject(), status: getStatus(book) });
};
