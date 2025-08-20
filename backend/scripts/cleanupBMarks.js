require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Book = require("../models/Book");
const BMarkf = require("../models/BMarkf");

const DRY_RUN = process.argv.includes("--dry"); // usage: npm run cleanup:bmarks -- --dry

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Connected");

  // 1) collect all occupied BMarks from books (where BMarkb is set)
  const usedDocs = await Book.find(
    { BMarkb: { $nin: [null, ""] } },
    { BMarkb: 1 }
  ).lean();

  // normalize: trim + lowercase
  const usedSet = new Set(
    usedDocs
      .map(d => (d.BMarkb || "").trim().toLowerCase())
      .filter(Boolean)
  );

  console.log(`📚 Books with occupied BMarks: ${usedSet.size}`);

  if (usedSet.size === 0) {
    console.log("ℹ️ Nothing to cleanup.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // 2) find which of those exist in BMarkf (should not be there)
  const existing = await BMarkf.find(
    { BMark: { $in: Array.from(usedSet) } },
    { BMark: 1 }
  ).lean();

  const toRemove = existing.map(x => x.BMark);
  console.log(`🧹 Will remove ${toRemove.length} BMarks from free pool (BMarkf).`);

  if (DRY_RUN) {
    console.log("🧪 Dry-run mode: no deletion performed. Sample:", toRemove.slice(0, 20));
    await mongoose.disconnect();
    process.exit(0);
  }

  if (toRemove.length > 0) {
    const result = await BMarkf.deleteMany({ BMark: { $in: toRemove } });
    console.log(`🗑️ Removed ${result.deletedCount} BMarks from BMarkf.`);
  } else {
    console.log("✅ Pool already clean — no overlaps.");
  }

  await mongoose.disconnect();
  process.exit(0);
})();
