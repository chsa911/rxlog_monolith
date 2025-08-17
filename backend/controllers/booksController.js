const Book = require('../models/Book');

exports.registerBook = async (req, res) => {
    try {
        const data = req.body;

        // Assign a mark from BMarkf (simplified example)
        const assignedMark = data.BMarkf.shift();
        data.BMarkb = assignedMark;

        const book = new Book(data);
        await book.save();

        res.status(201).json({ message: 'Book registered successfully', book });
    } catch (err) {
        res.status(500).json({ message: 'Registration failed', error: err.message });
    }
};
