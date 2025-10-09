// backend/models/Book.js
const { Schema, model, models } = require('mongoose');

const bookSchema = new Schema(
  {
    BBreite: { type: Number, required: true },   // width (cm)
    BHoehe:  { type: Number, required: true },   // height (cm)

    BAutor:  { type: String,  required: true },
    BKw:     { type: String,  required: true, maxlength: 25 },
    BKP:     { type: Number,  required: true, max: 99 },

    BKw1:    { type: String,  maxlength: 25 },
    BK1P:    { type: Number,  max: 99 },
    BKw2:    { type: String,  maxlength: 25 },
    BK2P:    { type: Number,  max: 99 },

    BVerlag: { type: String,  required: true, maxlength: 25 },
    BSeiten: { type: Number,  required: true, max: 9999 },

    // Registration date
    BEind:   { type: Date,    default: Date.now },

    // H/V fields (single flag + timestamp)
    // include `null` in enum so default null is valid
    BHVorV:   { type: String, enum: ['H', 'V', null], default: null },
    BHVorVAt: { type: Date, default: null },

    // Top flag + timestamp
    BTop:   { type: Boolean, default: false },
    BTopAt: { type: Date, default: null }, // we won't clear this once set

    // current active mark (belegt)
    BMarkb: { type: String, default: null, index: true },

    // alias for new schema
    barcode: { type: String, default: null, index: true },

    // --- Delayed release scheduling + audit ---
    // when the current mark should be returned to the pool
    BMarkReleaseDue: { type: Date, default: null },
    // when it actually was returned
    BMarkReleasedAt: { type: Date, default: null },
  },
  { minimize: false }
);

// Keep BMarkb and barcode in sync (alias fields)
bookSchema.pre('save', function(next) {
  if (this.isModified('barcode') && !this.isModified('BMarkb')) {
    this.BMarkb = this.barcode;
  } else if (this.isModified('BMarkb') && !this.isModified('barcode')) {
    this.barcode = this.BMarkb;
  }
  next();
});

// Helpful indexes
bookSchema.index({ BEind: -1 });
bookSchema.index({ BHVorVAt: -1 });
bookSchema.index({ BTopAt: -1 });
bookSchema.index({ BMarkReleaseDue: 1, BMarkb: 1 });

module.exports = models.Book || model('Book', bookSchema);
