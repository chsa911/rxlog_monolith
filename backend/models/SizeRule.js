// backend/models/SizeRule.js
const { Schema, model, models, SchemaTypes } = require('mongoose');

const BandSchema = new Schema(
  {
    condition: { type: String, enum: ['lt', 'gt', 'eq'], required: true },
    value: { type: Number, default: null },    // for lt/gt
    values: { type: [Number], default: [] },   // for eq
    prefix: { type: String, required: true },  // e.g., "egk"
    // allow optional extras (position/color/exclude, etc.) without validation errors
  },
  { _id: false, strict: false }
);

const SizeRuleSchema = new Schema(
  {
    // NEW style scope (preferred):
    // scope: { W: { min, max, minInclusive, maxInclusive } }
    scope: {
      type: SchemaTypes.Mixed, // we just store what’s in Mongo; logic handles it
      default: undefined
    },

    // LEGACY width bounds (still supported/read by code):
    minB: { type: Number, default: null },
    minBInc: { type: Boolean, default: true },
    maxB: { type: Number, default: null },
    maxBInc: { type: Boolean, default: true },

    // Alternative legacy naming if you migrate to W later:
    minW: { type: Number, default: null },
    minWInc: { type: Boolean, default: true },
    maxW: { type: Number, default: null },
    maxWInc: { type: Boolean, default: true },

    // Height bands within this width scope
    bands: { type: [BandSchema], default: [] },
  },
  {
    collection: 'sizerules',   // <-- canonical name (lowercase plural)
    strict: false,
    timestamps: false,
  }
);

// Helpful index for lookups (works whether you use scope.W or legacy fields)
SizeRuleSchema.index(
  {
    'scope.W.min': 1,
    'scope.W.max': 1,
    minB: 1,
    maxB: 1,
    minW: 1,
    maxW: 1,
  },
  { name: 'bounds_hint' }
);

module.exports = models.SizeRule || model('SizeRule', SizeRuleSchema);
