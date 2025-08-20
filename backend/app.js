// backend/app.js
const express = require('express');
const cors = require('cors');

const booksRoutes = require('./routes/books');
const bmarksRoutes = require('./routes/bmarks');

const app = express();

// ✅ middleware FIRST
app.use(cors({ origin: 'http://localhost:5173' })); // or app.use(cors()) in dev
app.use(express.json());

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// ✅ then routes
app.use('/api/books', booksRoutes);
app.use('/api/bmarks', bmarksRoutes);

module.exports = app;
