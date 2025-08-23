// frontend/src/pages/BooksPage.jsx
import { useEffect, useState } from "react";
import { listBooks } from "../api/books";
import BooksTable from "../components/BooksTable";

export default function BooksPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await listBooks({ page, limit });
      setRows(res.data || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, limit]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bücher</h1>
      {loading ? (
        <div className="p-4 text-sm">Laden…</div>
      ) : (
        <BooksTable books={rows} />
      )}
      {/* pagination controls can go here */}
    </div>
  );
}
