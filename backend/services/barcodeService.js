// backend/services/barcodeService.js
// Centralized barcode logic: find, reserve, assign, free, availability checks.

const mongoose = require("mongoose");

const FREE_FILTER_BASE = {
  isAvailable: true,
  status: { $in: ["free", "available"] },
  assignedBookId: { $exists: false },
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Atomically pick an existing, available barcode (filtered by sizeRange/prefix) and reserve it.
 * Returns the reserved barcode document (contains ._id, .code, etc.) or throws if none.
 */
async function pickAndReserve({ sizeRange, prefix } = {}, { session } = {}) {
  const col = mongoose.connection.collection("barcodes");

  const filter = {
    ...FREE_FILTER_BASE,
    ...(sizeRange ? { sizeRange } : {}),
    ...(prefix ? { code: new RegExp(`^${escapeRegex(prefix)}`, "i") } : {}),
  };

  const update = {
    $set: { isAvailable: false, status: "reserved" },
    $currentDate: { reservedAt: true, updatedAt: true },
  };

  const options = { sort: { code: 1 }, returnDocument: "after", session };

  const res = await col.findOneAndUpdate(filter, update, options);
  if (!res.value) throw new Error("no barcodes for this sizeRange available");
  return res.value;
}

/**
 * Assign a reserved barcode to a book (reserved -> assigned).
 */
async function assignReserved(barcodeId, bookId, { session } = {}) {
  const col = mongoose.connection.collection("barcodes");

  const res = await col.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(barcodeId),
      isAvailable: false,
      status: "reserved",
      assignedBookId: { $exists: false },
    },
    {
      $set: { status: "assigned", assignedBookId: bookId },
      $currentDate: { updatedAt: true },
    },
    { returnDocument: "after", session }
  );

  if (!res.value) throw new Error("Failed to assign barcode (concurrency).");
  return res.value;
}

/**
 * Free a barcode back to available.
 */
async function free(codeOrId, { session } = {}) {
  const col = mongoose.connection.collection("barcodes");
  const selector =
    /^[a-f\d]{24}$/i.test(codeOrId)
      ? { _id: new mongoose.Types.ObjectId(codeOrId) }
      : { code: new RegExp(`^${escapeRegex(codeOrId)}$`, "i") };

  const res = await col.findOneAndUpdate(
    selector,
    {
      $set: { isAvailable: true, status: "available" },
      $unset: { assignedBookId: 1, reservedAt: 1 },
      $currentDate: { updatedAt: true },
    },
    { returnDocument: "after", session }
  );

  return res.value || null;
}

/**
 * Quick existence/availability probe (for UI).
 */
async function existsAvailable({ sizeRange, prefix } = {}) {
  const col = mongoose.connection.collection("barcodes");

  const filter = {
    ...FREE_FILTER_BASE,
    ...(sizeRange ? { sizeRange } : {}),
    ...(prefix ? { code: new RegExp(`^${escapeRegex(prefix)}`, "i") } : {}),
  };

  const doc = await col.findOne(filter, { projection: { _id: 1 } });
  return !!doc;
}

module.exports = {
  pickAndReserve,
  assignReserved,
  free,
  existsAvailable,
};
