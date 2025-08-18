// backend/models/BMarkf.js
const mongoose = require('mongoose');

const bmarkfSchema = new mongoose.Schema({
  BMark: { type: String, required: true, unique: true, index: true }, // e.g. "egk001"
  rank: { type: Number, required: true, index: true },                // lower = better
}, { timestamps: true });

bmarkfSchema.index({ rank: 1, BMark: 1 });

module.exports = mongoose.model('BMarkf', bmarkfSchema);
