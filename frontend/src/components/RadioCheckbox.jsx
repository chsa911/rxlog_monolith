exports.updateCompletion = async (req, res) => {
  const { bookId } = req.params;
  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    if (book.BMarkb) {
      // Return BMark to available marks
      book.BMarkf.push(book.BMarkb);
      book.BMarkb = null;
    }
    book.BErg = new Date();
    await book.save();

    res.json({ message: 'Book updated successfully', book });
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
};
