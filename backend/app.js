const express = require('express');
const mongoose = require('mongoose');
const booksRoutes = require('./routes/books');
const bmarksRoutes = require('./routes/bmarks');

const app = express();
app.use(express.json());

// Routes
app.use('/api/books', booksRoutes);
app.use('/api/bmarks', bmarksRoutes);

module.exports = app;
