// frontend/src/components/BooksTable.jsx
import { useEffect, useState } from "react";
import { fetchBooks, setTop, setStatus } from "@/api/books";
import { useAppContext } from "@/context/AppContext";

export default function BooksTable() {
  const { refreshBooks } = useAppContext();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState(""); // '', 'open', 'historisiert', 'vorzeitig'
  const [topOnly, setTopOnly] = useState(false);
  const [since, setSince] = useState("");         // YYYY-MM-DD
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetchBooks({
        q,
        page,
        limit: 10,
        sortBy: "BEind",
        sortDir: "desc",
        ...(status ? { status } : {}),
        ...(topOnly ? { topOnly: true } : {}),
        ...(since ? { since } : {}),
      });
      setItems(res.items);
      setPages(res.pages);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
      setItems([]);
      setPages(1);
      setTotal(0);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status, topOnly, since, page]);

  const onToggleTop = async (book) => {
    try {
      const updated = await setTop(book._id, !book.BTop);
      setItems((arr) => arr.map((b) => (b._id === updated._id ? updated : b)));
      refreshBooks(); // notify others
    } catch (e) {
      alert(e?.message || "Fehler beim Setzen von Top");
    }
  };

  const onChangeStatus = async (book, nextStatus) => {
    try {
      const updated = await setStatus(book._id, nextStatus);
      setItems((arr) => arr.map((b) => (b._id === updated._id ? updated : b)));
      refreshBooks(); // notify others (pool changed if historisiert/vorzeitig)
    } catch (e) {
      alert(e?.message || "Fehler beim Setzen des Status");
    }
  };

  const start = (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);

  return (
    <div className="p-4 border rounded space-y-3">
      <h2 className="text-xl font-bold">Books</h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Suche (Autor, Stichwort, Verlag, BMark)"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="border p-2 rounded min-w-[240px]"
        />
        <select value={status} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border p-2 rounded">
          <option value="">Status: alle</option>
          <option value="open">Open</option>
          <option value="historisiert">Historisiert</option>
          <option value="vorzeitig">Vorzeitig</option>
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={topOnly} onChange={(e) => { setTopOnly(e.target.checked); setPage(1); }} />
          Top only
        </label>
        <input type="date" value={since} onChange={(e) => { setSince(e.target.value); setPage(1); }} className="border p-2 rounded" />
      </div>

      <div className="text-sm text-gray-600">
        {busy ? "Laden…" : total ? `${start}–${end} von ${total}` : "Keine Ergebnisse"}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-50">
              <Th>Autor</Th>
              <Th>Stichwort</Th>
              <Th>BMark</Th>
              <Th>Seiten</Th>
              <Th>Top</Th>
              <Th>Status</Th>
              <Th>Erfasst</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b._id} className="border-t">
                <Td>{b.BAutor}</Td>
                <Td>{b.BKw}</Td>
                <Td>{b.BMarkb ?? "—"}</Td>
                <Td>{b.BSeiten}</Td>
                <Td>
                  <input type="checkbox" checked={!!b.BTop} onChange={() => onToggleTop(b)} />
                </Td>
                <Td>
                  <select value={b.status || "open"} onChange={(e) => onChangeStatus(b, e.target.value)} className="border p-1 rounded">
                    <option value="open">Open</option>
                    <option value="historisiert">Historisiert</option>
                    <option value="vorzeitig">Vorzeitig</option>
                  </select>
                </Td>
                <Td>{b.BEind ? new Date(b.BEind).toLocaleDateString() : "—"}</Td>
              </tr>
            ))}
            {!busy && items.length === 0 && (
              <tr><td colSpan={7} className="text-center p-4">Keine Ergebnisse</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setPage(1)} disabled={page <= 1} className="border rounded px-2 py-1">⏮</button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="border rounded px-2 py-1">◀</button>
        <span>Seite {page} / {pages}</span>
        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="border rounded px-2 py-1">▶</button>
        <button onClick={() => setPage(pages)} disabled={page >= pages} className="border rounded px-2 py-1">⏭</button>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left font-semibold p-2 border-b">{children}</th>;
}
function Td({ children }) {
  return <td className="p-2">{children}</td>;
}
