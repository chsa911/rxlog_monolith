// backend/utils/bmarkUsage.js
const Book = require('../models/Book');

async function countCodeUsage(code) {
  if (!code) return 0;
  return Book.countDocuments({
    $or: [{ BMarkb: code }, { barcode: code }],
  });
}

module.exports = { countCodeUsage };
