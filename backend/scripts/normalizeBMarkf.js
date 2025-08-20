require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const BMarkf = require("../models/BMarkf");

(async () => {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log("✅ Connected");

  const all = await BMarkf.find({}, { BMark: 1, rank: 1 }).lean();
  let updates = 0;

  for (const d of all) {
    const norm = (d.BMark || "").trim().toLowerCase();
    if (norm && norm !== d.BMark) {
      await BMarkf.updateOne({ _id: d._id }, { $set: { BMark: norm } });
      updates++;
    }
  }
  console.log(`✳️ Normalized ${updates} documents (trim+lowercase).`);

  await mongoose.disconnect();
  process.exit(0);
})();
