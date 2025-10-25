// test-size.js  (place at repo root, next to /backend)
const mongoose = require("mongoose");
const { sizeToPrefixFromDb } = require("./backend/utils/sizeToPrefixFromDb");

// Use the same DB you checked in mongosh (rxlog). Override via MONGO_URI if needed.
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rxlog";

(async () => {
  try {
    await mongoose.connect(uri);
    console.log("Connected to:", uri);

    const tests = [
      [10.5, 17.4], // expect egk (gk < 17.5)
      [10.5, 21.0], // expect lgk (gk eq 20.5/21/21.5)
      [10.5, 22.0] // expect ogk (gk > 17.5)
    ];

    for (const [w, h] of tests) {
      const prefix = await sizeToPrefixFromDb(w, h);
      console.log(`${w} × ${h} =>`, prefix);
    }
  } catch (err) {
    console.error("Error:", err && (err.stack || err.message || err));
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
})();
