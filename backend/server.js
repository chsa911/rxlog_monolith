// backend/server.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  debug: true,
  override: true,
});
const mongoose = require("mongoose");
const app = require("./app");

// ✅ Read from env, provide defaults
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rxlog";

console.log("[env] MONGO_URI =", process.env.MONGO_URI);

let startReleaseJob = null;
try {
  ({ start: startReleaseJob } = require("./jobs/releaseMarks"));
} catch { /* ignore if missing */ }

(async () => {
  try {
    // ✅ Use the defined variable
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");
    console.log("DB name:", mongoose.connection.name);

    if (typeof startReleaseJob === "function") startReleaseJob();

    // ✅ app is the Express instance exported from app.js
    app.listen(PORT, () => {
      console.log(`🚀 API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Mongo connection error:", err);
    process.exit(1);
  }
})();

process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down...");
  try { await mongoose.disconnect(); } catch {}
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("\n👋 Shutting down (SIGTERM)...");
  try { await mongoose.disconnect(); } catch {}
  process.exit(0);
});
