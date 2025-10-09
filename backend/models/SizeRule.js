// backend/models/SizeRule.js
const { Schema, model, models } = require('mongoose');

const BandSchema = new Schema(
  {
    condition: { type: String, enum: ['lt', 'gt', 'eq'], required: true },
    value: { type: Number, default: null },   // for lt/gt
    values: { type: [Number], default: [] },  // for eq
    prefix: { type: String, required: true }, // e.g., "egk"
  },
  { _id: false }
);

const SizeRuleSchema = new Schema(
  {
    // Width band (Breite)
    minB: { type: Number, default: null },      // inclusive by default
    minBInc: { type: Boolean, default: true },  // if provided
    maxB: { type: Number, default: null },
    maxBInc: { type: Boolean, default: true },

    // Height bands within this width band
    bands: { type: [BandSchema], default: [] },
  },
  {
    collection: 'sizeRules',
    strict: false,
    timestamps: false,
  }
);

module.exports = models.SizeRule || model('SizeRule', SizeRuleSchema);
