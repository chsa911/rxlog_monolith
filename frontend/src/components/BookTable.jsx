import React, { useState, useEffect } from "react";
import axios from "axios";

const BookTable = () => {
  const [books, setBooks] = useState([]);
  const [sortField, setSortField] = useState("BAutor");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filter, setFilter] = useState(""); // "recentTop" | "recentFinished"

  const fetchBooks = async () => {
    const res = await axios.get("/api/books", {
      params: { sortField, sortOrder, filter }
    });
    setBooks(res.data);
  };

  useEffect(() => {
    fetchBooks();
  }, [sortField, sortOrder, filter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleUpdate = async (bookId, updates) => {
    try {
      await axios.patch(`/api/books/${bookId}`, updates);
      fetchBooks();
      alert("Update successful!");
    } catch (err) {
      alert("Error updating book.");
    }
  };

  return (
    <div>
      <div>
        <label>Filter: </label>
        <select onChange={(e) => setFilter(e.target.value)} value={filter}>
          <option value="">All</option>
          <option value="recentTop">Recently Top</option>
          <option value="recentFinished">Recently Finished</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            {["BAutor", "BSeiten", "BKw", "BVerlag", "BMark"].map((field) => (
              <th key={field} onClick={() => handleSort(field)}>
                {field} {sortField === field ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
            ))}
            <th>BErg</th>
            <th>BTop</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book._id}>
              <td>{book.BAutor}</td>
              <td>{book.BSeiten}</td>
              <td>{book.BKw}</td>
              <td>{book.BVerlag}</td>
              <td>{book.BMarkb}</td>
              <td>
                <label>
                  <input
                    type="radio"
                    name={`BErg-${book._id}`}
                    checked={book.BErg === "completed"}
                    onChange={() =>
                      handleUpdate(book._id, { BErg: "completed" })
                    }
                  />
                  Completed
                </label>
                <label>
                  <input
                    type="radio"
                    name={`BErg-${book._id}`}
                    checked={book.BErg === "not completed"}
                    onChange={() =>
                      handleUpdate(book._id, { BErg: "not completed" })
                    }
                  />
                  Not Completed
                </label>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={book.BTop || false}
                  onChange={() =>
                    handleUpdate(book._id, { BTop: !book.BTop })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BookTable;
