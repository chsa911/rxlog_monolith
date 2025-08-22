// backend/models/BMarkf.js
const { Schema, model, models } = require('mongoose');

const bmarkfSchema = new Schema({
  BMark: { type: String, required: true },
  rank: { type: Number, default: 0 },
});

// single-field index explicitly
bmarkfSchema.index({ BMark: 1 });

// 👇 Guarded export prevents OverwriteModelError on re-require
module.exports = models.BMarkf || model('BMarkf', bmarkfSchema);
