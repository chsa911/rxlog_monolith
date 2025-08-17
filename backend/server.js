const express = require("express");
const mongoose = require("mongoose");
const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/booksDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Book schema
const bookSchema = new mongoose.Schema({
    BAutor: String,
    BSeiten: Number,
    BKw: String,
    BVerlag: String,
    BMarkb: String,
    BMarkf: [String],
    BErg: { type: String, enum: ["completed", "not completed"], default: null },
    BTop: { type: Boolean, default: false },
    BEind: { type: Date, default: Date.now },
    BTopTimestamp: Date,
    BErgTimestamp: Date,
});

const Book = mongoose.model("Book", bookSchema);

// --- GET /api/books?sortField=BAutor&sortOrder=asc&filter=recentTop
app.get("/api/books", async (req, res) => {
    const { sortField = "BAutor", sortOrder = "asc", filter = "" } = req.query;
    const sortOptions = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    let query = {};
    if (filter === "recentTop") {
        query = { BTop: true };
    } else if (filter === "recentFinished") {
        query = { BErg: "completed" };
    }

    try {
        const books = await Book.find(query).sort(sortOptions).limit(100); // pagination optional
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PATCH /api/books/:id
app.patch("/api/books/:id", async (req, res) => {
    const bookId = req.params.id;
    const updates = req.body;

    try {
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ error: "Book not found" });

        // Handle BErg changes: move BMarkb back to BMarkf if updated
        if (updates.BErg && updates.BErg !== book.BErg) {
            book.BErg = updates.BErg;
            book.BErgTimestamp = new Date();

            // Return BMarkb to BMarkf if marking completed or not completed
            if (!book.BMarkf.includes(book.BMarkb)) {
                book.BMarkf.push(book.BMarkb);
            }
            book.BMarkb = null;
        }

        // Handle BTop checkbox
        if (updates.BTop !== undefined) {
            book.BTop = updates.BTop;
            book.BTopTimestamp = new Date();
        }

        // Apply any other updates
        for (let key in updates) {
            if (key !== "BErg" && key !== "BTop") {
                book[key] = updates[key];
            }
        }

        await book.save();
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- POST /api/books
// Optional: add new book registration
app.post("/api/books", async (req, res) => {
    try {
        const newBook = new Book(req.body);
        await newBook.save();
        res.json(newBook);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
