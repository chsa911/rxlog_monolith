// backend/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const app = express();

/* ---------- middleware (before routes) ---------- */
app.use(morgan("dev"));
app.use(express.json());

/**
 * CORS with credentials:
 * - Reads allowed origins from CORS_ORIGIN (comma-separated)
 * - Also allows any http://localhost:<port> (dev convenience)
 * - IMPORTANT: when credentials:true, we must NOT send "*" for origin
 */
function makeCorsOptions() {
  const envList =
    (process.env.CORS_ORIGIN ||
      "http://localhost:5173,http://localhost:5174,http://localhost:5175")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server, curl, tests
      const o = origin.toLowerCase();
      const isLocalhost = /^http:\/\/localhost:\d{2,5}$/.test(o);
      if (envList.includes(o) || isLocalhost) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true, // allow cookies/credentials
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  };
}
const corsOptions = makeCorsOptions();

app.use(cors(corsOptions));
// Preflight for all routes
app.options("*", cors(corsOptions));

mongoose.connection.once("open", () => {
  console.log("✅ Mongo connected to DB:", mongoose.connection.db.databaseName);
});

/* ---------- health ---------- */
app.get("/health", (_req, res) => res.send("ok"));

/* ---------- routes ---------- */
app.use("/api/barcodes", require("./routes/api/barcodes/debug"));
app.use("/api/barcodes", require("./routes/api/barcodes/previewBarcode"));
app.use("/api/books", require("./routes/books"));
app.use("/api/bmarks", require("./routes/bmarks")); // keep if present

/* ---------- error handler ---------- */
app.use((err, req, res, _next) => {
  console.error("UNCAUGHT ERROR:", err.message || err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

module.exports = app;
