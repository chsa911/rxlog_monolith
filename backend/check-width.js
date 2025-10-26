// backend/check-width.js
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");

const parseNum = (x) => {
  const s = String(x ?? "").trim().replace(/\s+/g, "");
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function coversWidth(doc, W) {
  const sw = doc.scope?.W;
  if (sw) {
    const min = sw.min ?? -Infinity;
    const max = sw.max ?? Infinity;
    const minInc = sw.minInclusive !== false;
    const maxInc = sw.maxInclusive !== false;
    const lowerOk = minInc ? W >= min : W > min;
    const upperOk = maxInc ? W <= max : W < max;
    return lowerOk && upperOk;
  }
  const min = doc.minW ?? doc.minB ?? -Infinity;
  const max = doc.maxW ?? doc.maxB ?? Infinity;
  const minInc = (doc.minWInc ?? doc.minBInc) !== false;
  const maxInc = (doc.maxWInc ?? doc.maxBInc) !== false;
  const lowerOk = minInc ? W >= min : W > min;
  const upperOk = maxInc ? W <= max : W < max;
  return lowerOk && upperOk;
}

(async () => {
  try {
    const SizeRule = require("./models/SizeRule");
    const width = parseNum(process.argv[2] ?? "12.5");
    if (!Number.isFinite(width)) {
      console.error("Invalid width:", process.argv[2]);
      process.exit(2);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB:", mongoose.connection.name, "width:", width);

    const docs = await SizeRule.find(
      {},
      { scope: 1, minB: 1, maxB: 1, minBInc: 1, maxBInc: 1, minW: 1, maxW: 1, minWInc: 1, maxWInc: 1, bands: 1 }
    ).lean();

    const matches = docs.filter(d => coversWidth(d, width));
    if (matches.length !== 1) {
      console.warn("Expected exactly 1 scope; got", matches.length);
      for (const m of matches) {
        const W = m.scope?.W;
        console.warn("→ scope",
          W ? `[${W.min}${W.minInclusive===false?")":"]"} .. ${W.max}${W.maxInclusive===false?"(" : "]"}]`
            : `[${m.minW ?? m.minB} .. ${m.maxW ?? m.maxB}]`
        );
      }
    }
    console.log(JSON.stringify(matches, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
