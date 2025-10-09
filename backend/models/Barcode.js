// backend/models/Barcode.js
const { Schema, model, models } = require('mongoose');

const barcodeSchema = new Schema(
  {
    // Human-readable full code, e.g. "egk001"
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // Series/prefix, e.g. "egk"
    series: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    // Numeric suffix (often zero-padded), e.g. "001"
    triplet: {
      type: String,
      default: null,
      trim: true,
    },

    // Optional visuals/metadata
    stripesTotal: { type: Number, default: 0 },
    rank: { type: Number, default: 0, index: true },

    // Availability & reservation state
    isAvailable: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['free', 'available', 'reserved', 'assigned', 'unavailable', 'blocked'],
      default: 'free',
      index: true,
    },
    reservedAt: { type: Date, default: null },

    // Normalized code (lowercase) for quick lookups
    code_norm: { type: String, index: true },

    // Back-link to the Book once assigned (optional)
    assignedBookId: { type: Schema.Types.ObjectId, ref: 'Book', default: null },
  },
  { timestamps: true, minimize: false }
);

// Helpful compound index for "next available in series"
barcodeSchema.index({ series: 1, rank: 1, triplet: 1, code: 1 });

// Keep code_norm synced; ensure series is lowercase
barcodeSchema.pre('save', function (next) {
  if (this.isModified('code') && this.code) {
    this.code_norm = String(this.code).toLowerCase();
  }
  if (this.isModified('series') && this.series) {
    this.series = String(this.series).toLowerCase();
  }
  next();
});

// Small utility: normalize on update as well (for findOneAndUpdate paths)
barcodeSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  // Handle $set payloads
  const set = update.$set || update;
  if (set.code) {
    set.code_norm = String(set.code).toLowerCase();
  }
  if (set.series) {
    set.series = String(set.series).toLowerCase();
  }
  // Reassign if using $set
  if (update.$set) this.setUpdate({ ...update, $set: set });
  else this.setUpdate(set);
  next();
});

module.exports = models.Barcode || model('Barcode', barcodeSchema);
