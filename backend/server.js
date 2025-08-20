    // backend/server.js
    require('dotenv').config();
    const mongoose = require('mongoose');
    const app = require('./app');
    const booksRoutes = require("./routes/books");


    const PORT = Number(process.env.PORT || 4000);
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmarkdb';

    app.use("/api/books", booksRoutes);

    mongoose.connect(MONGO_URI)
      .then(() => {
        console.log('✅ MongoDB connected');
        app.listen(PORT, () => console.log(`🚀 API listening on http://localhost:${PORT}`));
      })
      .catch(err => {
        console.error('❌ Mongo connection error:', err);
        process.exit(1);
      });

    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down...');
      await mongoose.disconnect();
      process.exit(0);
    });
