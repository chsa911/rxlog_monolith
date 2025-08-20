require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Book = require("../models/Book");
const BMarkf = require("../models/BMarkf");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const used = await Book.find({ BMarkb: { $nin: [null, ""] } }, { BMarkb: 1 }).lean();

  const usedSet = new Set(
    used.map(x => (x.BMarkb || "").trim())
        .filter(Boolean)
  );

  const missing = [];
  for (const code of usedSet) {
    const exists = await BMarkf.exists({ BMark: code });
    if (!exists) missing.push(code);
  }

  console.log(`Occupied total: ${usedSet.size}`);
  console.log(`Not in free pool (as expected or mismatched): ${missing.length}`);
  if (missing.length) {
    console.log(missing.slice(0, 50)); // preview first 50
  }

  await mongoose.disconnect();
  process.exit(0);
})();
