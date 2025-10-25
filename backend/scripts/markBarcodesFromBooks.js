#!/usr/bin/env node
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rxlog";
const alsoMarkFree = process.argv.includes("--mark-free"); // default: only mark used

const Barcodes = mongoose.connection.collection("barcodes");
const Books = mongoose.connection.collection("books");

(async () => {
  await mongoose.connect(MONGO_URI);

  const used = (await Books.distinct("BMarkb"))
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  console.log(`Used in books: ${used.length}`);

  // One-pass pipeline update (MongoDB >= 4.2)
  const pipeline = [
    { $set: { codeLC: { $toLower: { $ifNull: ["$code", "$BMark"] } } } },
    {
      $set: {
        status: {
          $cond: [
            { $in: ["$codeLC", used] },
            "assigned",
            alsoMarkFree ? "free" : "$status",
          ],
        },
        isAvailable: {
          $cond: [
            { $in: ["$codeLC", used] },
            false,
            alsoMarkFree ? true : "$isAvailable",
          ],
        },
      },
    },
    { $unset: "codeLC" },
  ];

  const res = await Barcodes.updateMany({}, pipeline);
  console.log("Update result:", res);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
