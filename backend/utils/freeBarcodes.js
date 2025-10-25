// backend/utils/freeBarcodes.js
const Barcode = require("../models/Barcode");

/**
 * Free all given codes. If bookId is provided, only free codes currently
 * assigned to that book (extra safety).
 */
async function freeBarcodes(codes = [], bookId = null) {
  const list = (codes || []).filter(Boolean);
  if (!list.length) return { modified: 0 };

  const match = { code: { $in: list } };
  if (bookId) match.assignedBookId = bookId;

  const res = await Barcode.updateMany(match, {
    $set: {
      isAvailable: true,
      status: "available",
      reservedAt: null,
      assignedBookId: null
    }
  });

  return { modified: res.modifiedCount || 0 };
}

module.exports = { freeBarcodes };
