import { useEffect, useMemo, useRef, useState } from "react";
import { listBooks, updateBook } from "../api/books";

// Safe display helpers
const show = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return v;
};
const toLocale = (ts) => (ts ? new Date(ts).toLocaleString() : "—");

/**
 * Robust getter:
 * - tries exact keys
 * - then case-insensitive matches
 * - then looks inside common nests: attributes, data, _doc, doc
 */
function pickAny(obj, ...candidates) {
  if (!obj) return null;
  const tryGet = (o, key) => {
    if (!o) return undefined;
    const v = o[key];
    return v === undefined ? undefined : v;
  };
  const nonEmpty = (v) =>
    !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));

  // 1) direct + case-insensitive lookup
  const keys = Object.keys(obj);
  const lowerMap = new Map(keys.map((k) => [k.toLowerCase(), k]));

  for (const cand of candidates) {
    // direct
    const v1 = tryGet(obj, cand);
    if (nonEmpty(v1)) return v1;

    // CI
    const kci = lowerMap.get(String(cand).toLowerCase());
    if (kci) {
      const v2 = tryGet(obj, kci);
      if (nonEmpty(v2)) return v2;
    }
  }

  // 2) common nests
  const nests = ["attributes", "data", "_doc", "doc"];
  for (const nest of nests) {
    const child = obj[nest];
    if (child && typeof child === "object") {
      const keys2 = Object.keys(child);
      const lowerMap2 = new Map(keys2.map((k) => [k.toLowerCase(), k]));
      for (const cand of candidates) {
        const v1 = tryGet(child, cand);
        if (nonEmpty(v1)) return v1;
        const kci = lowerMap2.get(String(cand).toLowerCase());
        if (kci) {
          const v2 = tryGet(child, kci);
          if (nonEmpty(v2)) return v2;
        }
      }
    }
  }

  return null;
}

export default function SearchUpdatePage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(""); // no default date filter
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ data: [], page: 1, pages: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [debug, setDebug] = useState(false);

  const params = useMemo(() => {
    const p = { page, limit: 20, sort: "BEind", order: "desc" };
    if (from) p.createdFrom = from;
    if (to) p.createdTo = to;
    if (query?.trim()) p.q = query.trim();
    return p;
  }, [page, from, to, query]);

  // Cancel stale requests so older responses can't overwrite newer ones
  const abortRef = useRef(null);

  async function fetchData(p = 1) {
    setLoading(true);
    try {
      setPage(p);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const payload = await listBooks({ ...params, page: p, signal: abortRef.current.signal });
      setResult(payload);
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        alert("Fehler beim Laden");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setHV(id, value) {
    try {
      await updateBook(id, { BHVorV: value });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  async function setTop(id, value) {
    try {
      await updateBook(id, { BTop: value });
      await fetchData(page);
    } catch (e) {
      console.error(e);
      alert("Update fehlgeschlagen");
    }
  }

  function deriveHV(b) {
    const hv = pickAny(b, "BHVorV", "BHVOrV", "hv", "HV");
    const at = pickAny(b, "BHVorVAt", "BHVOrVAt", "hvAt");
    if (hv === "H" || hv === "V") return { hv, at };
    return { hv: null, at: null };
  }

  // Optional: log first row keys for quick inspection
  if (debug && result?.data?.length) {
    // eslint-disable-next-line no-console
    console.log("First row keys:", Object.keys(result.data[0]));
    // eslint-disable-next-line no-console
    console.log("First row sample:", result.data[0]);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suche &amp; Update (H/V &amp; Top)</h1>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
          Debug: {debug ? "An" : "Aus"}
        </label>
      </div>

      {/* Filters */}
      <div className="p-4 border rounded grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span>Freitext</span>
          <input
            className="border rounded p-2"
            placeholder="Titel, Autor, Stichwort, Verlag, BMark…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Von</span>
          <input
            type="date"
            className="border rounded p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bis</span>
          <input
            type="date"
            className="border rounded p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <button onClick={() => fetchData(1)} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading ? "Laden…" : "Suchen"}
          </button>
          <button
            onClick={() => {
              setQuery("");
              setFrom("");
              setTo("");
              fetchData(1);
            }}
            className="px-4 py-2 border rounded"
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
              {debug && <th className="p-2">Debug</th>}
              <th className="p-2">BMark</th>
              <th className="p-2">Autor</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Verlag</th>
              <th className="p-2">Seiten</th>
              <th className="p-2">H/V</th>
              <th className="p-2">Top</th>
              <th className="p-2">Erfasst</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((b) => {
              const { hv, at } = deriveHV(b);

              // Try common names and variations (case-insensitive, nested)
              const mark = pickAny(b, "BMarkb", "BMark", "BMarks", "mark");
              const autor = pickAny(b, "BAutor", "Autor", "author");
              const kw = pickAny(b, "BKw", "keyword", "keywords", "kw");
              const verlag = pickAny(b, "BVerlag", "publisher", "Verlag");
              const seiten = pickAny(b, "BSeiten", "pages", "Seiten");
              const eind = pickAny(b, "BEind", "createdAt", "created", "created_at");

              const top = !!pickAny(b, "BTop", "top");
              const topAt = pickAny(b, "BTopAt", "topAt", "top_at");

              return (
                <tr key={b._id || pickAny(b, "_id", "id")} className="border-t align-top">
                  {debug && (
                    <td className="p-2">
                      <div className="text-xs text-gray-700">
                        <div className="font-mono whitespace-pre-wrap">
                          {show(Object.keys(b).join(", "))}
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer">JSON</summary>
                          <pre className="max-w-[40ch] overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(b, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </td>
                  )}

                  <td className="p-2 font-mono">{show(mark)}</td>
                  <td className="p-2">{show(autor)}</td>
                  <td className="p-2">{show(kw)}</td>
                  <td className="p-2">{show(verlag)}</td>
                  <td className="p-2">{show(seiten)}</td>

                  {/* H/V radios */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`hv-${b._id || pickAny(b, "_id", "id")}`}
                          checked={hv === null}
                          onChange={() => setHV(pickAny(b, "_id", "id"), null)}
                        />{" "}
                        —
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`hv-${b._id || pickAny(b, "_id", "id")}`}
                          checked={hv === "H"}
                          onChange={() => setHV(pickAny(b, "_id", "id"), "H")}
                        />{" "}
                        H
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`hv-${b._id || pickAny(b, "_id", "id")}`}
                          checked={hv === "V"}
                          onChange={() => setHV(pickAny(b, "_id", "id"), "V")}
                        />{" "}
                        V
                      </label>
                      <span className="text-xs text-gray-500">{toLocale(at)}</span>
                    </div>
                  </td>

                  {/* Top radios */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`top-${b._id || pickAny(b, "_id", "id")}`}
                          checked={!top}
                          onChange={() => setTop(pickAny(b, "_id", "id"), false)}
                        />{" "}
                        Nein
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`top-${b._id || pickAny(b, "_id", "id")}`}
                          checked={top}
                          onChange={() => setTop(pickAny(b, "_id", "id"), true)}
                        />{" "}
                        Ja
                      </label>
                      <span className="text-xs text-gray-500">{toLocale(topAt)}</span>
                    </div>
                  </td>

                  <td className="p-2">{toLocale(eind)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
