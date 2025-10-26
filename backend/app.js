// backend/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

/* ---------- middleware (before routes) ---------- */
app.use(morgan('dev'));
app.use(express.json());

// CORS first, so every route gets the headers
const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(s => s.trim());
app.use(cors({ origin: allowed }));

mongoose.connection.once('open', () => {
  console.log('✅ Mongo connected to DB:', mongoose.connection.db.databaseName);
});

/* ---------- health ---------- */
app.get('/health', (_req, res) => res.send('ok'));

/* ---------- routes ---------- */
// Debug (temporary)
app.use('/api/barcodes', require('./routes/api/barcodes/debug'));

// Preview
app.use('/api/barcodes', require('./routes/api/barcodes/previewBarcode'));

// Books
app.use('/api/books', require('./routes/books'));

/* ---------- error handler ---------- */
app.use((err, req, res, _next) => {
  console.error('UNCAUGHT ERROR:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = app;
