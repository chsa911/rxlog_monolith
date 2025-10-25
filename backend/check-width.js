// backend/check-width.js
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");

(async () => {
  try {
    const SizeRule = require("./models/SizeRule");
    const width = Number(process.argv[2] ?? "12.5"); // pass width as arg

    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB:", mongoose.connection.name, "width:", width);

    const docs = await SizeRule.find(
      {
        $and: [
          { $or: [{ minB: null }, { minB: { $lte: width } }] },
          { $or: [{ maxB: null }, { maxB: { $gte: width } }] }
        ]
      },
      { minB: 1, minBInc: 1, maxB: 1, maxBInc: 1, bands: 1 }
    ).lean();

    console.log(JSON.stringify(docs, null, 2));
    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
