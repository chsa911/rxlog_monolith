require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Book = require("../models/Book");
const BMarkf = require("../models/BMarkf");

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Connected");

  // 1. get all occupied BMarks from Book collection
  const used = await Book.find({ BMarkb: { $ne: null } }, { BMarkb: 1 }).lean();
  const usedMarks = used.map((b) => b.BMarkb);

  console.log(`📚 Found ${usedMarks.length} occupied BMarks in Book collection`);

  if (usedMarks.length > 0) {
    // 2. remove them from free pool
    const result = await BMarkf.deleteMany({ BMark: { $in: usedMarks } });
    console.log(`🗑️ Removed ${result.deletedCount} BMarks from BMarkf pool`);
  } else {
    console.log("ℹ️ No occupied BMarks found");
  }

  await mongoose.disconnect();
  process.exit(0);
})();
