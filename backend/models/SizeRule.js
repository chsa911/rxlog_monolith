const mongoose = require('mongoose');

const bandSchema = new mongoose.Schema({
  // height conditions
  hMin:   { type: Number, default: null },  // if set: h >= hMin
  hMax:   { type: Number, default: null },  // if set: h <  hMax (exclusive)
  equals: { type: [Number], default: [] },  // exact mid heights (20.5 / 21 / 21.5)
  prefix: { type: String, required: true }
}, { _id: false });

const sizeRuleSchema = new mongoose.Schema({
  // width window: (wMin, wMax]  — i.e. w > wMin AND w <= wMax
  wMin:     { type: Number, default: null }, // null means -∞ (first bucket)
  wMax:     { type: Number, required: true },// inclusive
  priority: { type: Number, default: 0, index: true },
  bands:    { type: [bandSchema], default: [] }
}, { timestamps: true });

sizeRuleSchema.index({ wMax: 1, wMin: 1, priority: 1 });

module.exports = mongoose.model('SizeRule', sizeRuleSchema);
