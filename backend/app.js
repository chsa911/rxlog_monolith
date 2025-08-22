const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// middleware
app.use(morgan('dev'));
app.use(express.json());

// CORS for Vite dev at 5173
app.use(cors({ origin: 'http://localhost:5173' }));

// health check
app.get('/health', (_req, res) => res.send('ok'));

// routes
app.use('/api/bmarks', require('./routes/bmarks'));
app.use('/api/books', require('./routes/books'));

// error handler
app.use((err, req, res, next) => {
  console.error('UNCAUGHT ERROR:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

module.exports = app;
