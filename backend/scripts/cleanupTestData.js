
/* eslint-disable no-console */
// backend/scripts/cleanupTestData.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

// Adjust paths if your models live elsewhere
const Book = require("../models/Book");
const Barcode = require("../models/Barcode");

/**
 * >>> EDIT THIS FILTER <<<
 * Define what “test documents” means in YOUR data.
 * Common heuristics below; keep only what applies.
 */
const BOOKS_MATCH = {
  $or: [
    // Titles/keywords that look like tests
    { BAutor: { $regex: /\b(test|dummy|demo|probe)\b/i } },
    { BKw:    { $regex: /\b(test|dummy|demo|probe)\b/i } },
    { BVerlag:{ $regex: /\b(test|dummy|demo|probe)\b/i } },

    // Barcodes reserved for testing (e.g., series “zz”)
    { barcode: { $regex: /^zz/i } },
    { BMarkb:  { $regex: /^zz/i } },

    // Recently created junk during development — adjust the date!
    { createdAt: { $gte: new Date("2025-10-25T00:00:00.000Z") } },
  ],
};

// DRY RUN first! Set to false to actually delete/update.
const DRY_RUN = process.env.DRY_RUN ?? "true"; // "true" | "false"

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to", mongoose.connection.name);

  // 1) Find books that match the test filter
  const books = await Book.find(BOOKS_MATCH)
    .select("_id barcode BMarkb createdAt BAutor BKw BVerlag")
    .lean();

  const ids = books.map(b => b._id);
  // Collect barcodes from both possible fields
  const codes = Array.from(
    new Set(
      books
        .flatMap(b => [b.barcode, b.BMarkb])
        .filter(Boolean)
        .map(String)
        .map(s => s.trim().toLowerCase())
    )
  );

  console.log("— Preview —");
  console.log("Books matching filter:", books.length);
  console.log("Unique barcodes to release:", codes.length);
  if (books.length) {
    console.table(books.slice(0, 10).map(b => ({
      _id: String(b._id),
      barcode: b.barcode || b.BMarkb || null,
      BAutor: b.BAutor || "",
      BKw: b.BKw || "",
      BVerlag: b.BVerlag || "",
      createdAt: b.createdAt,
    })));
    if (books.length > 10) console.log(`…and ${books.length - 10} more`);
  }

  const reallyDelete = String(DRY_RUN).toLowerCase() === "false";
  console.log("DRY_RUN =", String(DRY_RUN).toUpperCase(), "→", reallyDelete ? "WILL DELETE" : "NO CHANGES");

  if (!reallyDelete) {
    await mongoose.disconnect();
    return;
  }

  // 2) Delete books + 3) Release barcodes atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Delete all matching books
      const del = await Book.deleteMany(BOOKS_MATCH, { session });
      console.log("Books deleted:", del.deletedCount);

      if (codes.length) {
        const upd = await Barcode.updateMany(
          { code: { $in: codes } },
          {
            $set: { isAvailable: true, status: "available", assignedAt: null, reservedAt: null, assignedBookId: null },
            $currentDate: { updatedAt: true },
          },
          { session }
        );
        console.log("Barcodes released (matched/modified):", upd.matchedCount, "/", upd.modifiedCount);
      }
    });

    console.log("✅ Cleanup committed.");
  } catch (err) {
    console.error("❌ Cleanup failed, rolling back:", err);
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
