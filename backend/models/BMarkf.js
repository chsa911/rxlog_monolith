// backend/models/BMarkf.js
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  BMark: { type: String, required: true, unique: true, index: true }, // e.g. "egk001"
  rank:  { type: Number, required: true, index: true }                 // 0(best), then 1,2…
}, { timestamps: true });

schema.index({ BMark: 1 }, { unique: true });
schema.index({ rank: 1, BMark: 1 });

module.exports = mongoose.model('BMarkf', schema);
