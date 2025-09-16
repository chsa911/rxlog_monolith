const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

// middleware
app.use(morgan('dev'));
app.use(express.json());

// CORS for Vite dev at 5173
// backend/app.js
const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());
app.use(cors({ origin: allowed }));

mongoose.connection.once('open', () => {
  console.log('✅ Mongo connected to DB:', mongoose.connection.db.databaseName);
});

// health check
app.get('/health', (_req, res) => res.send('ok'));

//disable caching in dev
app.use('/api/bmarks', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, require('./routes/bmarks'));

// routes
app.use('/api/bmarks', require('./routes/bmarks'));
app.use('/api/books', require('./routes/books'));

// error handler
app.use((err, req, res, next) => {
  console.error('UNCAUGHT ERROR:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

module.exports = app;
