import { useEffect, useMemo, useState } from "react";
import { listBooks, updateBook } from "../api/books";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SearchUpdatePage() {
  const [query, setQuery] = useState("");          // free text (BMark, Autor, Verlag…)
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ data: [], page: 1, pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p = { page, limit: 20, sort: "BEind", order: "desc" };
    if (from) p.createdFrom = from;
    if (to)   p.createdTo   = to;
    if (query?.trim()) p.q = query.trim(); // server searches also in BMarkb
    return p;
  }, [page, from, to, query]);

  async function fetchData(p = 1) {
    setLoading(true);
    try {
      setPage(p);
      const payload = await listBooks({ ...params, page: p });
      setResult(payload);
    } catch (e) {
      console.error(e);
      alert("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1); // initial load (today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Radio: set BHVorV to "H" or "V" (stamps BHVorVAt)
  async function setHV(id, value /* 'H' | 'V' */) {
    try {
      await updateBook(id, { BHVorV: value });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  // Checkbox: toggle BTop (stamps/clears BTopAt)
  async function toggleTop(id, current) {
    try {
      await updateBook(id, { BTop: !current });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Suche &amp; Update (H/V &amp; Top)</h1>

      {/* Filters */}
      <div className="p-4 border rounded grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span>Freitext (BMark, Autor, Keyword, Verlag …)</span>
          <input
            className="border rounded p-2"
            placeholder="z.B. egk001 oder Autor"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Von (Datum)</span>
          <input type="date" className="border rounded p-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bis (Datum)</span>
          <input type="date" className="border rounded p-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <button onClick={() => fetchData(1)} className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
            {loading ? "Laden…" : "Suchen"}
          </button>
          <button
            onClick={() => { setQuery(""); setFrom(todayISO()); setTo(todayISO()); }}
            className="px-4 py-2 rounded border"
            disabled={loading}
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">BMark</th>
              <th className="p-2 text-left">Autor</th>
              <th className="p-2 text-left">Keyword</th>
              <th className="p-2 text-left">Verlag</th>
              <th className="p-2 text-left">Ergebnis</th>
              <th className="p-2 text-left">Toptitel</th>
              <th className="p-2 text-left">Erfasst</th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 && !loading && (
              <tr><td className="p-4" colSpan={8}>Keine Treffer</td></tr>
            )}
            {result.data.map((b) => (
              <tr key={b._id} className="border-t">
                <td className="p-2 font-mono">{b.BMarkb || "—"}</td>
                <td className="p-2">{b.BAutor}</td>
                <td className="p-2">{b.BKw}</td>
                <td className="p-2">{b.BVerlag}</td>

                {/* Single radio group: H or V */}
                <td className="p-2">
                  <div className="flex gap-4 items-center">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name={`hv-${b._id}`}
                        value="H"
                        checked={b.BHVorV === "H"}
                        onChange={() => setHV(b._id, "H")}
                      />
                      H (Historisiert)
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name={`hv-${b._id}`}
                        value="V"
                        checked={b.BHVorV === "V"}
                        onChange={() => setHV(b._id, "V")}
                      />
                      V (Vorzeitig)
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  {b.BHVorVAt ? new Date(b.BHVorVAt).toLocaleString() : "—"}
                </td>

                {/* Top checkbox */}
                <td className="p-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!b.BTop}
                      onChange={() => toggleTop(b._id, b.BTop)}
                    />
                    Top-Titel
                  </label>
                </td>
                <td className="p-2">
                  {b.BTopAt ? new Date(b.BTopAt).toLocaleString() : "—"}
                </td>

                <td className="p-2">
                  {b.BEind ? new Date(b.BEind).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-1 border rounded"
          disabled={loading || result.page <= 1}
          onClick={() => fetchData(result.page - 1)}
        >
          ◀︎ Zurück
        </button>
        <div>Seite {result.page} / {Math.max(1, result.pages)}</div>
        <button
          className="px-3 py-1 border rounded"
          disabled={loading || result.page >= result.pages}
          onClick={() => fetchData(result.page + 1)}
        >
          Weiter ▶︎
        </button>
        <div className="ml-auto text-sm text-gray-500">{result.total} Treffer</div>
      </div>
    </div>
  );
}
