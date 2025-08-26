// backend/models/Book.js
const { Schema, model, models } = require('mongoose');

const bookSchema = new Schema({
  BBreite: { type: Number, required: true },   // width
  BHoehe:  { type: Number, required: true },   // height
  BAutor:  { type: String,  required: true },
  BKw:     { type: String,  required: true, maxlength: 25 },
  BKP:     { type: Number,  required: true, max: 99 },
  BKw1:    { type: String,  maxlength: 25 },
  BK1P:    { type: Number,  max: 99 },
  BKw2:    { type: String,  maxlength: 25 },
  BK2P:    { type: Number,  max: 99 },
  BVerlag: { type: String,  required: true, maxlength: 25 },
  BSeiten: { type: Number,  required: true, max: 9999 },
  BEind:   { type: Date,    default: Date.now },     // registration date

  // H/V fields (single flag + timestamp)
  BHVorV:   { type: String, enum: ['H','V'], default: null },
  BHVorVAt: { type: Date, default: null },

  // Top flag + timestamp
  BTop:   { type: Boolean, default: false },
  BTopAt: { type: Date, default: null },


  // current active mark (belegt)
  BMarkb: { type: String, default: null, index: true },
});

module.exports = models.Book || model('Book', bookSchema);
