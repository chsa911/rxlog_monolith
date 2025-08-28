import { useEffect, useMemo, useState } from "react";
import { listBooks, updateBook } from "../api/books";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SearchUpdatePage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ data: [], page: 1, pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p = { page, limit: 20, sort: "BEind", order: "desc" };
    if (from) p.createdFrom = from;
    if (to)   p.createdTo   = to;
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

  useEffect(() => { fetchData(1); }, []);

  async function setHV(id, value /* 'H' | 'V' | null */) {
    try {
      await updateBook(id, { BHVorV: value });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  async function setTop(id, value /* true | false */) {
    try {
      await updateBook(id, { BTop: value });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  function deriveHV(b) {
    if (b.BHVorV === 'H' || b.BHVorV === 'V') return { hv: b.BHVorV, at: b.BHVorVAt };
    return { hv: null, at: null };
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Suche &amp; Update (H/V &amp; Top)</h1>

      {/* Filters */}
      <div className="p-4 border rounded grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span>Freitext</span>
          <input className="border rounded p-2" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Von</span>
          <input type="date" className="border rounded p-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bis</span>
          <input type="date" className="border rounded p-2" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <button onClick={() => fetchData(1)} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading ? "Laden…" : "Suchen"}
          </button>
          <button onClick={() => { setQuery(""); setFrom(todayISO()); setTo(todayISO()); }} className="px-4 py-2 border rounded">
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">BMark</th>
              <th className="p-2">Autor</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Verlag</th>
              <th className="p-2">H/V</th>
              <th className="p-2">Top</th>
              <th className="p-2">Erfasst</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((b) => {
              const { hv, at } = deriveHV(b);
              return (
                <tr key={b._id} className="border-t">
                  <td className="p-2 font-mono">{b.BMarkb || "—"}</td>
                  <td className="p-2">{b.BAutor}</td>
                  <td className="p-2">{b.BKw}</td>
                  <td className="p-2">{b.BVerlag}</td>

                  {/* H/V radios with reset */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1">
                        <input type="radio" name={`hv-${b._id}`} checked={hv === null} onChange={() => setHV(b._id, null)} /> —
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="radio" name={`hv-${b._id}`} checked={hv === "H"} onChange={() => setHV(b._id, "H")} /> H
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="radio" name={`hv-${b._id}`} checked={hv === "V"} onChange={() => setHV(b._id, "V")} /> V
                      </label>
                      <span className="text-xs text-gray-500">{at ? new Date(at).toLocaleString() : "—"}</span>
                    </div>
                  </td>

                  {/* Top radios with timestamp */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1">
                        <input type="radio" name={`top-${b._id}`} checked={!b.BTop} onChange={() => setTop(b._id, false)} /> Nein
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="radio" name={`top-${b._id}`} checked={b.BTop} onChange={() => setTop(b._id, true)} /> Ja
                      </label>
                      <span className="text-xs text-gray-500">
                        {b.BTopAt ? new Date(b.BTopAt).toLocaleString() : "—"}
                      </span>
                    </div>
                  </td>

                  <td className="p-2">{b.BEind ? new Date(b.BEind).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
