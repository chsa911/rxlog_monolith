import { useEffect, useMemo, useState } from "react";
import { listBooks, updateBook } from "../api/books";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function SearchUpdatePage() {
  const [query, setQuery] = useState("");

  // ⬇️ Standard: letzte 7 Tage inkl. heute
  const [from, setFrom] = useState(daysAgoISO(6));
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ data: [], page: 1, pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState({}); // in-flight updates pro Zeile

  const params = useMemo(() => {
    const p = { page, limit: 20, sort: "BEind", order: "desc" };
    if (from) p.createdFrom = from;
    if (to) p.createdTo = to;
    if (query?.trim()) p.q = query.trim();
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
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Actions ---
  // Optimistisch: API-Response direkt in Tabelle übernehmen, damit Timestamps sofort sichtbar sind
  async function setHV(id, value /* 'H' | 'V' */) {
    try {
      setPending((p) => ({ ...p, [id]: true }));
      const updated = await updateBook(id, { BHVorV: value });
      setResult((prev) => ({
        ...prev,
        data: prev.data.map((b) => (b._id === id ? { ...b, ...updated } : b)),
      }));
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  // One-way Top: nur auf true setzen; nie ausschalten
  async function markTop(id, isTop) {
    if (isTop) return; // bereits Top
    try {
      setPending((p) => ({ ...p, [id]: true }));
      const updated = await updateBook(id, { BTop: true });
      setResult((prev) => ({
        ...prev,
        data: prev.data.map((b) => (b._id === id ? { ...b, ...updated } : b)),
      }));
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  // Defensive: H/V + Timestamp aus neuen oder Legacy-Feldern ableiten
  function deriveHV(b) {
    if (b.BHVorV === "H" || b.BHVorV === "V") return { hv: b.BHVorV, at: b.BHVorVAt };
    if (b.BHistorisiert) return { hv: "H", at: b.BHistorisiertAt };
    if (b.BVorzeitig) return { hv: "V", at: b.BVorzeitigAt };
    return { hv: null, at: null };
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Suche &amp; Update (H/V &amp; Top)</h1>

      {/* Filter */}
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
          <input
            type="date"
            className="border rounded p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bis (Datum)</span>
          <input
            type="date"
            className="border rounded p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            onClick={() => fetchData(1)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? "Laden…" : "Suchen"}
          </button>
          <button
            onClick={() => {
              setQuery("");
              setFrom(daysAgoISO(6)); // Reset auf letzte 7 Tage
              setTo(todayISO());
            }}
            className="px-4 py-2 rounded border"
            disabled={loading}
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Ergebnisse */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">BMark</th>
              <th className="p-2 text-left">Autor</th>
              <th className="p-2 text-left">Keyword</th>
              <th className="p-2 text-left">Verlag</th>
              <th className="p-2 text-left">H/V</th>
              <th className="p-2 text-left">Top</th>
              <th className="p-2 text-left">Erfasst</th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 && !loading && (
              <tr>
                <td className="p-4" colSpan={7}>
                  Keine Treffer
                </td>
              </tr>
            )}
            {result.data.map((b) => {
              const { hv, at } = deriveHV(b);
              return (
                <tr key={b._id} className="border-t">
                  <td className="p-2 font-mono">{b.BMarkb || "—"}</td>
                  <td className="p-2">{b.BAutor}</td>
                  <td className="p-2">{b.BKw}</td>
                  <td className="p-2">{b.BVerlag}</td>

                  {/* H/V mit Timestamp */}
                  <td className="p-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`hv-${b._id}`}
                            value="H"
                            checked={hv === "H"}
                            disabled={!!pending[b._id]}
                            onChange={() => setHV(b._id, "H")}
                            onClick={() => {
                              if (hv === "H" && !at) setHV(b._id, "H");
                            }}
                          />
                          H
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`hv-${b._id}`}
                            value="V"
                            checked={hv === "V"}
                            disabled={!!pending[b._id]}
                            onChange={() => setHV(b._id, "V")}
                            onClick={() => {
                              if (hv === "V" && !at) setHV(b._id, "V");
                            }}
                          />
                          V
                        </label>
                      </div>
                      <span className="text-xs text-gray-500">
                        {at ? new Date(at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </td>

                  {/* Top: Einmal-Schalter + Timestamp */}
                  <td className="p-2">
                    {b.BTop ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 border rounded text-xs">
                          Top
                        </span>
                        <span className="text-xs text-gray-500">
                          {b.BTopAt ? new Date(b.BTopAt).toLocaleString() : "—"}
                        </span>
                      </div>
                    ) : (
                      <button
                        className="px-2 py-1 border rounded text-xs"
                        onClick={() => markTop(b._id, b.BTop)}
                        disabled={loading || !!pending[b._id]}
                      >
                        Als Top markieren
                      </button>
                    )}
                  </td>

                  <td className="p-2">
                    {b.BEind ? new Date(b.BEind).toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
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
        <div>
          Seite {result.page} / {Math.max(1, result.pages)}
        </div>
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
