// frontend/src/pages/SearchUpdatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listBooks, updateBook } from "../api/books";

/* ---------- tolerant field picker ---------- */
// normalize: lower-case, strip non-alphanum
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// pick the first existing value by alias; searches top-level keys (robust to case/underscores)
function pick(b, aliases, { joinArray = ", " } = {}) {
  if (!b || typeof b !== "object") return undefined;
  const keyMap = new Map(Object.keys(b).map((k) => [norm(k), k]));
  for (const alias of aliases) {
    const k = keyMap.get(norm(alias));
    if (k != null) {
      const v = b[k];
      if (Array.isArray(v)) return v.filter(Boolean).join(joinArray);
      return v;
    }
  }
  return undefined;
}

// small helpers using pick + aliases
const getBarcode   = (b) => pick(b, ["barcode", "BMarkb", "BMark", "code", "Barcode"]) ?? "—";
const getAuthor    = (b) => pick(b, ["BAutor", "Autor", "author", "Author"]) ?? "—";
const getKeyword   = (b) => pick(b, ["BKw", "Stichwort", "Schlagwort", "keyword", "keywords"]) ?? "—";
const getPublisher = (b) => pick(b, ["BVerlag", "Verlag", "publisher", "Publisher"]) ?? "—";
const getPages = (b) => {
  const raw = pick(b, ["BSeiten", "Seiten", "pages", "Pages", "Seite", "page_count"]);
  if (raw === undefined || raw === null || raw === "") return "—";
  const n = Number(raw);
  return Number.isFinite(n) ? n : String(raw); // show string if not numeric
};
const getCreatedAt = (b) => {
  const raw = pick(b, ["BEind", "createdAt", "CreatedAt", "created_on", "created"]);
  try { return raw ? new Date(raw).toLocaleString() : "—"; } catch { return "—"; }
};
const getTop = (b) => !!(pick(b, ["BTop", "top", "Topbook"]) ?? b?.BTop);

/* ------------------------------------------- */

export default function SearchUpdatePage() {
  const [q, setQ] = useState({ q: "", page: 1, limit: 20, sortBy: "BEind", order: "desc" });
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [updating, setUpdating] = useState(() => new Set());

  const canPrev = useMemo(() => q.page > 1, [q.page]);
  const canNext = useMemo(() => q.page * q.limit < total, [q.page, q.limit, total]);

  // debounce search input → query
  useEffect(() => {
    const t = setTimeout(() => setQ((p) => ({ ...p, q: searchText, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  // fetch when query changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const data = await listBooks(q);
        if (cancelled) return;
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setItems(list);
        setTotal(Number.isFinite(data?.total) ? data.total : list.length);

        // 🔎 one-time key peek to confirm shapes (comment out later)
        if (list?.length) {
          const sample = list[0];
          // eslint-disable-next-line no-console
          console.log("[books sample keys]", Object.keys(sample));
        }
      } catch (e) {
        if (!cancelled) { setItems([]); setTotal(0); setErr(e?.message || "Fehler beim Laden"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [q.page, q.limit, q.sortBy, q.order, q.q]);

  const idOf = (b) => b?._id || b?.id || getBarcode(b) || b?.code || "";

  function setQuery(patch) { setQ((prev) => ({ ...prev, ...patch })); }
  function nextPage() { if (canNext) setQuery({ page: q.page + 1 }); }
  function prevPage() { if (canPrev) setQuery({ page: q.page - 1 }); }

  function patchRow(id, patch) {
    if (!id) return;
    setItems((prev) => prev.map((it) => (idOf(it) === id ? { ...it, ...patch } : it)));
  }
  function setUpdatingOn(id, on = true) {
    setUpdating((prev) => { const n = new Set(prev); if (!id) return n; if (on) n.add(id); else n.delete(id); return n; });
  }

  async function toggleTop(b, nextVal) {
    const id = idOf(b); if (!id) return alert("Kein Datensatz-ID gefunden.");
    setUpdatingOn(id, true);
    const revert = { BTop: getTop(b) };
    try { patchRow(id, { BTop: !!nextVal }); await updateBook(id, { BTop: !!nextVal }); }
    catch (e) { patchRow(id, revert); alert(e?.message || "Update Topbook fehlgeschlagen"); }
    finally { setUpdatingOn(id, false); }
  }

  async function setStatus(b, nextStatus) {
    const id = idOf(b); if (!id) return alert("Kein Datensatz-ID gefunden.");
    setUpdatingOn(id, true);
    const revert = { status: b?.status ?? null };
    try { patchRow(id, { status: nextStatus }); await updateBook(id, { status: nextStatus }); }
    catch (e) { patchRow(id, revert); alert(e?.message || "Update Status fehlgeschlagen"); }
    finally { setUpdatingOn(id, false); }
  }

  return (
    <div className="p-4 space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Bücher verwalten</h1>

        {/* search */}
        <form
          className="flex w-full md:w-auto items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); setQ((p) => ({ ...p, q: searchText, page: 1 })); }}
        >
          <input
            className="flex-1 md:w-80 border rounded px-3 py-2"
            placeholder="Suche (Titel, Autor, Barcode …)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setQ((p) => ({ ...p, q: searchText, page: 1 })); } }}
          />
          <button type="submit" className="px-3 py-2 rounded border">Suchen</button>
          {searchText && (
            <button type="button" className="px-3 py-2 rounded border" onClick={() => setSearchText("")}>
              Leeren
            </button>
          )}
        </form>

        {/* sort/limit */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            Sortieren nach
            <select className="border rounded p-1" value={q.sortBy}
              onChange={(e) => setQuery({ sortBy: e.target.value, page: 1 })}>
              <option value="BEind">BEind</option>
              <option value="createdAt">Erstellt</option>
              <option value="BAutor">Autor</option>
              <option value="BVerlag">Verlag</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-1">
            Ordnung
            <select className="border rounded p-1" value={q.order}
              onChange={(e) => setQuery({ order: e.target.value, page: 1 })}>
              <option value="desc">↓ absteigend</option>
              <option value="asc">↑ aufsteigend</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-1">
            Pro Seite
            <select className="border rounded p-1" value={q.limit}
              onChange={(e) => setQuery({ limit: Number(e.target.value), page: 1 })}>
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
          </label>
        </div>
      </header>

      <div className="text-sm text-gray-600">
        Seite <strong>{q.page}</strong> • Einträge pro Seite <strong>{q.limit}</strong> • Gesamt <strong>{total}</strong>
        {q.q ? <> • Suche: <em>{q.q}</em></> : null}
      </div>

      {err && <div className="p-3 rounded border border-red-300 bg-red-50 text-red-700">{err}</div>}
      {loading && <div className="p-3 rounded border bg-gray-50 text-gray-700">Lade…</div>}
      {!loading && !err && items.length === 0 && (
        <div className="p-3 rounded border bg-yellow-50 text-yellow-800">Keine Einträge gefunden.</div>
      )}

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
                <Th label="Topbook" />
                <Th label="Abandoned" />
                <Th label="Finished" />
                <Th label="Erstellt" />
                <Th label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((b, i) => {
                const id = idOf(b) || i;
                const isBusy = updating.has(id);
                const status = String(b?.status || "").toLowerCase();
                const isAbandoned = status === "abandoned";
                const isFinished = status === "finished";
                return (
                  <tr key={id} className="border-t align-top">
                    <Td>{getBarcode(b)}</Td>
                    <Td>{getAuthor(b)}</Td>
                    <Td>{getKeyword(b)}</Td>
                    <Td>{getPublisher(b)}</Td>
                    <Td>{getPages(b)}</Td>
                    <Td>{getTop(b) ? "✓" : "—"}</Td>
                    <Td>{isAbandoned ? "✓" : "—"}</Td>
                    <Td>{isFinished ? "✓" : "—"}</Td>
                    <Td>{getCreatedAt(b)}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={isBusy}
                          onClick={() => toggleTop(b, !getTop(b))}
                          className="px-2 py-1 border rounded disabled:opacity-50"
                          title={getTop(b) ? "Topbook entfernen" : "Als Topbook markieren"}>
                          {getTop(b) ? "★ Top entfernen" : "☆ Top setzen"}
                        </button>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1 text-xs">
                            <input type="radio" name={`status-${id}`} disabled={isBusy}
                              checked={isAbandoned} onChange={() => setStatus(b, "abandoned")} />
                            Abandoned
                          </label>
                          <label className="inline-flex items-center gap-1 text-xs">
                            <input type="radio" name={`status-${id}`} disabled={isBusy}
                              checked={isFinished} onChange={() => setStatus(b, "finished")} />
                            Finished
                          </label>
                        </div>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={prevPage} disabled={!canPrev} className="px-3 py-1 rounded border disabled:opacity-50">
          ← Zurück
        </button>
        <span className="text-sm">
          Seite {q.page} / {Math.max(1, Math.ceil((total || 0) / q.limit))}
        </span>
        <button onClick={nextPage} disabled={!canNext} className="px-3 py-1 rounded border disabled:opacity-50">
          Weiter →
        </button>
      </div>
    </div>
  );
}

/* ---------- tiny helpers ---------- */
function Th({ label }) {
  return <th className="text-left px-2 py-2 border-b font-medium whitespace-nowrap">{label}</th>;
}
function Td({ children }) {
  return <td className="px-2 py-2 whitespace-nowrap">{children ?? "—"}</td>;
}
