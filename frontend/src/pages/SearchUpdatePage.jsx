// frontend/src/pages/SearchUpdatePage.jsx
import { useEffect, useMemo, useState } from "react";
import { listBooks } from "../api/books";

export default function SearchUpdatePage() {
  // --- query state (search/sort/paging) ---
  const [q, setQ] = useState({
    page: 1,
    limit: 20,
    sortBy: "BEind",   // keep legacy default your UI was using
    order: "desc",
    fields: "BAutor,BKw,titleKeyword"
  });

  // --- data state ---
  const [items, setItems] = useState([]);     // ALWAYS an array
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canPrev = useMemo(() => q.page > 1, [q.page]);
  const canNext = useMemo(() => q.page * q.limit < total, [q.page, q.limit, total]);

  // --- fetch books whenever query changes ---
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setErr("");
      try {
        const data = await listBooks(q); // { page, limit, total, items: [] }
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number.isFinite(data?.total) ? data.total : 0);
      } catch (e) {
        if (cancelled) return;
        setItems([]); // keep array to avoid .map crashes
        setTotal(0);
        setErr(typeof e === "string" ? e : e?.message || "Fehler beim Laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [q.page, q.limit, q.sortBy, q.order, q.fields]); // re-fetch on query changes

  // --- handlers ---
  function setQuery(patch) {
    setQ(prev => ({ ...prev, ...patch }));
  }
  function nextPage() {
    if (canNext) setQuery({ page: q.page + 1 });
  }
  function prevPage() {
    if (canPrev) setQuery({ page: q.page - 1 });
  }

  return (
    <div className="p-4 space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">Bücher verwalten</h1>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            Sortieren nach
            <select
              className="border rounded p-1"
              value={q.sortBy}
              onChange={e => setQuery({ sortBy: e.target.value, page: 1 })}
            >
              <option value="BEind">BEind</option>
              <option value="createdAt">Erstellt</option>
              <option value="BAutor">Autor</option>
              <option value="BVerlag">Verlag</option>
            </select>
          </label>

          <label className="text-sm flex items-center gap-1">
            Ordnung
            <select
              className="border rounded p-1"
              value={q.order}
              onChange={e => setQuery({ order: e.target.value, page: 1 })}
            >
              <option value="desc">↓ absteigend</option>
              <option value="asc">↑ aufsteigend</option>
            </select>
          </label>

          <label className="text-sm flex items-center gap-1">
            Pro Seite
            <select
              className="border rounded p-1"
              value={q.limit}
              onChange={e => setQuery({ limit: Number(e.target.value), page: 1 })}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      </header>

      {/* Status line */}
      <div className="text-sm text-gray-600">
        Seite <strong>{q.page}</strong> • Einträge pro Seite <strong>{q.limit}</strong> • Gesamt{" "}
        <strong>{total}</strong>
      </div>

      {/* Error / Loading / Empty */}
      {err && (
        <div className="p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {err}
        </div>
      )}

      {loading && (
        <div className="p-3 rounded border bg-gray-50 text-gray-700">Lade…</div>
      )}

      {!loading && !err && items.length === 0 && (
        <div className="p-3 rounded border bg-yellow-50 text-yellow-800">
          Keine Einträge gefunden.
        </div>
      )}

      {/* Table */}
      {!loading && !err && items.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <Th label="Barcode" />
                <Th label="Autor (BAutor)" />
                <Th label="Stichwort (BKw)" />
                <Th label="Verlag (BVerlag)" />
                <Th label="Seiten (BSeiten)" />
                <Th label="Erstellt" />
              </tr>
            </thead>
            <tbody>
              {(items || []).map((b) => (
                <tr key={b._id || b.barcode || b.BMarkb} className="border-t">
                  <Td>{b.barcode || b.BMarkb || b.BMark || "—"}</Td>
                  <Td>{b.BAutor || "—"}</Td>
                  <Td>{b.BKw || "—"}</Td>
                  <Td>{b.BVerlag || "—"}</Td>
                  <Td>{Number.isFinite(b.BSeiten) ? b.BSeiten : "—"}</Td>
                  <Td>{b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pager */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevPage}
          disabled={!canPrev}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          ← Zurück
        </button>
        <span className="text-sm">
          Seite {q.page} / {Math.max(1, Math.ceil(total / q.limit || 1))}
        </span>
        <button
          onClick={nextPage}
          disabled={!canNext}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}

/* ---------- tiny helpers ---------- */
function Th({ label }) {
  return (
    <th className="text-left px-2 py-2 border-b font-medium whitespace-nowrap">
      {label}
    </th>
  );
}
function Td({ children }) {
  return <td className="px-2 py-2 whitespace-nowrap">{children ?? "—"}</td>;
}
