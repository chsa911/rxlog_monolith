// backend/models/Book.js
const { Schema, model, models } = require("mongoose");
const Barcode = require("../models/Barcode");

// statuses that should free the barcode immediately
const FREE_STATUSES = new Set(["abandoned", "finished"]);

/**
 * Free any barcodes currently attached to this book.
 * - Frees by code (BMarkb / barcode).
 * - If assignedBookId is tracked on barcodes, only frees those linked to this book.
 * - Idempotent: safe to run multiple times.
 */
async function freeBookBarcodes(doc) {
  if (!doc) return;
  const codes = [doc.BMarkb, doc.barcode].filter(Boolean);
  if (!codes.length) return;

  const match = { code: { $in: codes } };
  if (doc._id) match.assignedBookId = doc._id;

  try {
    const res = await Barcode.updateMany(match, {
      $set: {
        isAvailable: true,
        status: "available",
        reservedAt: null,
        assignedBookId: null
      }
    });

    // mark audit on the book (do not block on it)
    try {
      await doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { BMarkReleasedAt: new Date(), BMarkReleaseDue: null } }
      );
    } catch (_) {}
    return res.modifiedCount || 0;
  } catch (e) {
    console.error(
      "[Book.freeBookBarcodes] error:",
      e && (e.stack || e.message || e)
    );
    return 0;
  }
}

const bookSchema = new Schema(
  {
    BBreite: { type: Number, required: true }, // width (cm)
    BHoehe: { type: Number, required: true }, // height (cm)

    BAutor: { type: String, required: true },
    BKw: { type: String, required: true, maxlength: 25 },
    BKP: { type: Number, required: true, max: 99 },

    BKw1: { type: String, maxlength: 25 },
    BK1P: { type: Number, max: 99 },
    BKw2: { type: String, maxlength: 25 },
    BK2P: { type: Number, max: 99 },

    BVerlag: { type: String, required: true, maxlength: 25 },
    BSeiten: { type: Number, required: true, max: 9999 },

    // Registration date
    BEind: { type: Date, default: Date.now },

    // H/V fields (single flag + timestamp)
    BHVorV: { type: String, enum: ["H", "V", null], default: null },
    BHVorVAt: { type: Date, default: null },

    // Top flag + timestamp
    BTop: { type: Boolean, default: false },
    BTopAt: { type: Date, default: null },

    // current active mark (belegt)
    BMarkb: { type: String, default: null, index: true },

    // alias for new schema
    barcode: { type: String, default: null, index: true },

    // Book lifecycle status (free barcodes on 'abandoned' / 'finished')
    status: { type: String, default: "open", index: true },

    // --- Delayed release scheduling + audit ---
    // when the current mark should be returned to the pool
    BMarkReleaseDue: { type: Date, default: null },
    // when it actually was returned
    BMarkReleasedAt: { type: Date, default: null }
  },
  { minimize: false }
);

// Keep BMarkb and barcode in sync (alias fields)
bookSchema.pre("save", function(next) {
  if (this.isModified("barcode") && !this.isModified("BMarkb")) {
    this.BMarkb = this.barcode;
  } else if (this.isModified("BMarkb") && !this.isModified("barcode")) {
    this.barcode = this.BMarkb;
  }
  next();
});

// Free barcodes right after a .save() if status requires it
bookSchema.post("save", async function(doc, next) {
  try {
    if (doc && FREE_STATUSES.has(doc.status)) {
      await freeBookBarcodes(doc);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Free barcodes right after findOneAndUpdate / findByIdAndUpdate
bookSchema.post("findOneAndUpdate", async function(doc) {
  try {
    if (doc && FREE_STATUSES.has(doc.status)) {
      await freeBookBarcodes(doc);
    }
  } catch (e) {
    console.error(
      "[Book post findOneAndUpdate] error:",
      e && (e.stack || e.message || e)
    );
  }
});

// Helpful indexes
bookSchema.index({ BEind: -1 });
bookSchema.index({ BHVorVAt: -1 });
bookSchema.index({ BTopAt: -1 });
bookSchema.index({ BMarkReleaseDue: 1, BMarkb: 1 });

module.exports = models.Book || model("Book", bookSchema);
