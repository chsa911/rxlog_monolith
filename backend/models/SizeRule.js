// models/SizeRule.js
const { Schema, model, models } = require('mongoose');

const bandSchema = new Schema({
  hMin:   { type: Number, default: null },
  hMax:   { type: Number, default: null },
  equals: { type: [Number], default: [] },
  prefix: { type: String, required: true },
}, { _id: false });

const sizeRuleSchema = new Schema({
  wMin:     { type: Number, default: null },
  wMax:     { type: Number, required: true },
  priority: { type: Number, default: 0, index: true },
  bands:    { type: [bandSchema], default: [] },
}, { timestamps: true });

sizeRuleSchema.index({ wMax: 1, wMin: 1, priority: 1 });

// 👇 Guarded export prevents OverwriteModelError
module.exports = models.SizeRule || model('SizeRule', sizeRuleSchema);
