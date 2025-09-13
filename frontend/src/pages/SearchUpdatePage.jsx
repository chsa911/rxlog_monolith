import { useEffect, useMemo, useRef, useState } from "react";
import { listBooks, updateBook } from "../api/books";

// Safe display helpers
const show = (v) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "")
    ? "—"
    : v;
const toLocale = (ts) => (ts ? new Date(ts).toLocaleString() : "—");

// Robust getter (case-insensitive + common nests)
function pickAny(obj, ...candidates) {
  if (!obj) return null;
  const tryGet = (o, k) =>
    o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
  const nonEmpty = (v) =>
    !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));
  const keys = Object.keys(obj);
  const lower = new Map(keys.map((k) => [k.toLowerCase(), k]));
  for (const c of candidates) {
    const v1 = tryGet(obj, c);
    if (nonEmpty(v1)) return v1;
    const k2 = lower.get(String(c).toLowerCase());
    if (k2) {
      const v2 = tryGet(obj, k2);
      if (nonEmpty(v2)) return v2;
    }
  }
  for (const nest of ["attributes", "data", "_doc", "doc"]) {
    const child = obj[nest];
    if (!child || typeof child !== "object") continue;
    const lower2 = new Map(Object.keys(child).map((k) => [k.toLowerCase(), k]));
    for (const c of candidates) {
      const v1 = tryGet(child, c);
      if (nonEmpty(v1)) return v1;
      const k2 = lower2.get(String(c).toLowerCase());
      if (k2) {
        const v2 = tryGet(child, k2);
        if (nonEmpty(v2)) return v2;
      }
    }
  }
  return null;
}

export default function SearchUpdatePage() {
  // Filters
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [exact, setExact] = useState(false);
  const [fieldFilter, setFieldFilter] = useState({
    BTitel: false,
    BAutor: true,
    BVerlag: false,
    BKw: true,
    BMarkb: false,
  });

  // Data / UI
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({
    data: [],
    page: 1,
    pages: 1,
    total: 0,
    limit: 20,
  });
  const [page, setPage] = useState(1);
  const [debug, setDebug] = useState(false);

  const isNumeric = useMemo(() => /^\d+$/.test(String(query).trim()), [query]);
  const selectedFields = useMemo(
    () => Object.entries(fieldFilter).filter(([, v]) => v).map(([k]) => k),
    [fieldFilter]
  );

  const params = useMemo(() => {
    const p = {
      page,
      limit: isNumeric ? 200 : 20,
      sort: "BEind",
      order: "desc",
    };
    if (from) p.createdFrom = from;
    if (to) p.createdTo = to;
    if (query?.trim()) p.q = query.trim();
    if (onlyMarked) p.onlyMarked = 1;
    if (!isNumeric && selectedFields.length) p.fields = selectedFields.join(",");
    if (!isNumeric && exact) p.exact = 1;
    return p;
  }, [page, from, to, query, isNumeric, onlyMarked, selectedFields, exact]);

  const abortRef = useRef(null);
  async function fetchData(p = 1) {
    setLoading(true);
    try {
      setPage(p);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const payload = await listBooks({
        ...params,
        page: p,
        signal: abortRef.current.signal,
      });
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
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line
  }, [onlyMarked, exact, selectedFields.join(","), isNumeric]);

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
    return hv === "H" || hv === "V" ? { hv, at } : { hv: null, at: null };
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suche &amp; Update (H/V &amp; Top)</h1>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          Debug: {debug ? "An" : "Aus"}
        </label>
      </div>

      {/* Filters */}
      <div className="p-4 border rounded grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span>Freitext / Seiten</span>
          <input
            className="border rounded p-2"
            placeholder="Titel, Autor, Stichwort, Verlag, BMark oder Seiten (z.B. 633 / 600-650)"
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
              setFrom("");
              setTo("");
              setOnlyMarked(false);
              setExact(false);
              setFieldFilter({
                BTitel: false,
                BAutor: true,
                BVerlag: false,
                BKw: true,
                BMarkb: false,
              });
              fetchData(1);
            }}
            className="px-4 py-2 border rounded"
            disabled={loading}
          >
            Zurücksetzen
          </button>
        </div>

        {/* Row 2: toggles */}
        <div className="md:col-span-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyMarked}
              onChange={(e) => setOnlyMarked(e.target.checked)}
            />
            Nur mit BMark
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={exact}
              onChange={(e) => setExact(e.target.checked)}
            />
            Exakte Suche
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-700">Nur in Feldern suchen:</span>
            {[
              ["BAutor", "Autor"],
              ["BVerlag", "Verlag"],
              ["BKw", "Keyword"],
              ["BTitel", "Titel"],
              ["BMarkb", "BMark"],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!fieldFilter[key]}
                  onChange={(e) =>
                    setFieldFilter((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="md:col-span-4 text-sm text-gray-600">
          Ergebnisse: <strong>{result.total ?? result.data.length}</strong>
          {" • "}Seite {result.page ?? 1} / {result.pages ?? 1}
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
              const id = b._id || pickAny(b, "_id", "id");

              const mark = pickAny(b, "BMarkb", "BMark", "mark");
              const autor = pickAny(b, "BAutor", "Autor", "author");
              const kw = pickAny(b, "BKw", "keyword", "keywords", "kw");
              const verlag = pickAny(b, "BVerlag", "publisher", "Verlag");
              const seiten = pickAny(b, "BSeiten", "Bseiten", "pages", "Seiten");
              const eind = pickAny(b, "BEind", "createdAt", "created", "created_at");

              const top = !!pickAny(b, "BTop", "top");
              const topAt = pickAny(b, "BTopAt", "topAt");

              return (
                <tr key={id} className="border-t align-top">
                  <td className="p-2 font-mono">{show(mark)}</td>
                  <td className="p-2">{show(autor)}</td>
                  <td className="p-2">{show(kw)}</td>
                  <td className="p-2">{show(verlag)}</td>
                  <td className="p-2">{show(seiten)}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <label>
                        <input
                          type="radio"
                          name={`hv-${id}`}
                          checked={hv === null}
                          onChange={() => setHV(id, null)}
                        />{" "}
                        —
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`hv-${id}`}
                          checked={hv === "H"}
                          onChange={() => setHV(id, "H")}
                        />{" "}
                        H
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`hv-${id}`}
                          checked={hv === "V"}
                          onChange={() => setHV(id, "V")}
                        />{" "}
                        V
                      </label>
                      <span className="text-xs text-gray-500">{toLocale(at)}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <label>
                        <input
                          type="radio"
                          name={`top-${id}`}
                          checked={!top}
                          onChange={() => setTop(id, false)}
                        />{" "}
                        Nein
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`top-${id}`}
                          checked={top}
                          onChange={() => setTop(id, true)}
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

      {/* Pagination Footer */}
      {result.pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            <button
              className="px-3 py-2 border rounded disabled:opacity-50"
              disabled={result.page <= 1 || loading}
              onClick={() => fetchData(result.page - 1)}
            >
              ← Zurück
            </button>
            <button
              className="px-3 py-2 border rounded disabled:opacity-50"
              disabled={result.page >= result.pages || loading}
              onClick={() => fetchData(result.page + 1)}
            >
              Weiter →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Seite</span>
            <input
              type="number"
              min={1}
              max={result.pages}
              defaultValue={result.page}
              className="w-20 border rounded p-1 text-center"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = Math.min(
                    Math.max(1, Number(e.currentTarget.value || 1)),
                    result.pages
                  );
                  fetchData(v);
                }
              }}
            />
            <span className="text-sm">/ {result.pages}</span>
          </div>
        </div>
      )}
    </div>
  );
}
