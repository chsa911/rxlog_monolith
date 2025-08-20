// backend/utils/sizeToPrefixFromDb.js
const mongoose = require("mongoose");

const sizeRuleSchema = new mongoose.Schema({
  minB: Number,
  maxB: Number,
  maxBInc: { type: Boolean, default: true },
  bands: [
    {
      condition: { type: String, enum: ["lt", "eq", "gt"] },
      value: Number,
      values: [Number],
      prefix: String,
    },
  ],
});

const SizeRule =
  mongoose.models.SizeRule || mongoose.model("SizeRule", sizeRuleSchema);

async function sizeToPrefixFromDb(BBreite, BHoehe) {
  const rules = await SizeRule.find({}).sort({ minB: 1 }).lean();

  for (const rule of rules) {
    // Check if BBreite fits the range
    const minOk = rule.minB == null || BBreite > rule.minB;
    const maxOk = rule.maxBInc ? BBreite <= rule.maxB : BBreite < rule.maxB;

    if (minOk && maxOk) {
      for (const band of rule.bands) {
        let matched = false;
        switch (band.condition) {
          case "lt":
            matched = BHoehe < band.value;
            break;
          case "gt":
            matched = BHoehe > band.value;
            break;
          case "eq":
            matched = band.values.includes(BHoehe);
            break;
        }

        if (matched) {
          return normalizeI(band.prefix);
        }
      }
    }
  }

  return null; // no match found
}

// Handle "i" → "ik" fallback rule
function normalizeI(prefix) {
  if (!prefix) return
