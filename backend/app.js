// backend/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

/* ---------- middleware ---------- */
app.use(morgan('dev'));
app.use(express.json()); // if needed: express.json({ limit: '2mb' })

// CORS for Vite dev at 5173 (supports comma-separated origins via CORS_ORIGIN)
const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());
app.use(cors({ origin: allowed }));

mongoose.connection.once('open', () => {
  console.log('✅ Mongo connected to DB:', mongoose.connection.db.databaseName);
});

/* ---------- health ---------- */
app.get('/health', (_req, res) => res.send('ok'));

/* ---------- routes (mounted once) ---------- */
// Disable caching for bmarks responses (dev)
const bmarksRouter = require('./routes/bmarks');
app.use(
  '/api/bmarks',
  (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
  bmarksRouter
);

const booksRouter = require('./routes/books');
app.use('/api/books', booksRouter);

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error('UNCAUGHT ERROR:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

module.exports = app;
