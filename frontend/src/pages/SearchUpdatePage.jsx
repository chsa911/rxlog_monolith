// frontend/pages/SearchUpdatePage.jsx
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
  const [pending, setPending] = useState({});
  const [edits, setEdits] = useState({}); // local row edits

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

  function handleChange(id, field, value) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveRow(id) {
    const body = edits[id];
    if (!body) return;
    try {
      setPending((p) => ({ ...p, [id]: true }));
      const updated = await updateBook(id, body);
      setResult((prev) => ({
        ...prev,
        data: prev.data.map((b) => (b._id === id ? { ...b, ...updated } : b)),
      }));
      setEdits((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
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

  // 🚀 NEW: Save all edited rows
  async function saveAll() {
    const ids = Object.keys(edits);
    for (const id of ids) {
      await saveRow(id);
    }
  }

  function deriveHV(b) {
    if (b.BHVorV === "H" || b.BHVorV === "V") return { hv: b.BHVorV, at: b.BHVorVAt };
    return { hv: null, at: null };
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold flex justify-between items-center">
        Suche &amp; Update (H/V &amp; Top)
        {Object.keys(edits).length > 0 && (
          <button
            onClick={saveAll}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm"
          >
            Alle Änderungen speichern ({Object.keys(edits).length})
          </button>
        )}
      </h1>

      {/* Filters */}
      <div className="p-4 border rounded grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span>Freitext</span>
          <input
            className="border rounded p-2"
            placeholder="z.B. Autor, Verlag, Stichwort …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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

      {/* Results Table */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">BMark</th>
              <th className="p-2">Autor</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">KWP</th>
              <th className="p-2">Verlag</th>
              <th className="p-2">Seiten</th>
              <th className="p-2">H/V</th>
              <th className="p-2">Top</th>
              <th className="p-2">Erfasst</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((b) => {
              const edit = edits[b._id] || {};
              const { hv, at } = deriveHV(b);

              return (
                <tr key={b._id} className="border-t">
                  <td className="p-2 font-mono">{b.BMarkb || "—"}</td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-32"
                      value={edit.BAutor ?? b.BAutor ?? ""}
                      onChange={(e) => handleChange(b._id, "BAutor", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-28"
                      value={edit.BKw ?? b.BKw ?? ""}
                      onChange={(e) => handleChange(b._id, "BKw", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-16"
                      value={edit.BKP ?? b.BKP ?? ""}
                      onChange={(e) => handleChange(b._id, "BKP", Number(e.target.value))}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-32"
                      value={edit.BVerlag ?? b.BVerlag ?? ""}
                      onChange={(e) => handleChange(b._id, "BVerlag", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-20"
                      value={edit.BSeiten ?? b.BSeiten ?? ""}
                      onChange={(e) => handleChange(b._id, "BSeiten", Number(e.target.value))}
                    />
                  </td>

                  {/* H/V */}
                  <td className="p-2">
                    <label>
                      <input
                        type="radio"
                        name={`hv-${b._id}`}
                        value="H"
                        checked={(edit.BHVorV ?? hv) === "H"}
                        onChange={() => handleChange(b._id, "BHVorV", "H")}
                      />{" "}
                      H
                    </label>
                    <label className="ml-2">
                      <input
                        type="radio"
                        name={`hv-${b._id}`}
                        value="V"
                        checked={(edit.BHVorV ?? hv) === "V"}
                        onChange={() => handleChange(b._id, "BHVorV", "V")}
                      />{" "}
                      V
                    </label>
                    <div className="text-xs text-gray-500">{at ? new Date(at).toLocaleString() : "—"}</div>
                  </td>

                  {/* Top */}
                  <td className="p-2">
                    {b.BTop ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 border rounded text-xs">Top</span>
                        <span className="text-xs text-gray-500">
                          {b.BTopAt ? new Date(b.BTopAt).toLocaleString() : "—"}
                        </span>
                      </div>
                    ) : (
                      <button
                        className="px-2 py-1 border rounded text-xs"
                        onClick={() => handleChange(b._id, "BTop", true)}
                      >
                        Als Top markieren
                      </button>
                    )}
                  </td>

                  <td className="p-2">{b.BEind ? new Date(b.BEind).toLocaleString() : "—"}</td>

                  <td className="p-2">
                    {edits[b._id] ? (
                      <button
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                        disabled={!!pending[b._id]}
                        onClick={() => saveRow(b._id)}
                      >
                        {pending[b._id] ? "Speichern…" : "Speichern"}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
