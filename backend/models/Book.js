// backend/models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  BBreite: { type: Number, required: true },   // width
  BHoehe: { type: Number, required: true },    // height
  BAutor: { type: String, required: true },
  BKw: { type: String, required: true, maxlength: 25 },
  BKP: { type: Number, required: true, max: 2 },
  BKw1: { type: String, maxlength: 25 },
  BK1P: { type: Number, max: 2 },
  BKw2: { type: String, maxlength: 25 },
  BK2P: { type: Number, max: 2 },
  BVerlag: { type: String, required: true, maxlength: 25 },
  BSeiten: { type: Number, required: true, max: 9999 },
  BEind: { type: Date, default: Date.now },     // registration date

  // Control fields
  BTop: { type: Boolean, default: false },
  BTopAt: { type: Date, default: null },

  BHistorisiert: { type: Boolean, default: false },
  BHistorisiertAt: { type: Date, default: null },

  BVorzeitig: { type: Boolean, default: false },
  BVorzeitigAt: { type: Date, default: null },

  // current active mark (belegt)
  BMarkb: { type: String, default: null, index: true },
});

module.exports = mongoose.model('Book', bookSchema);
