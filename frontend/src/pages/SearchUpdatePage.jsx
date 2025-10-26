// frontend/src/pages/SearchUpdatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listBooks, updateBook } from "../api/books";

export default function SearchUpdatePage() {
  // --- query state (search/sort/paging) ---
  const [q, setQ] = useState({
    page: 1,
    limit: 20,
    sortBy: "BEind", // legacy default
    order: "desc",
  });

  // --- data state ---
  const [items, setItems] = useState([]); // always an array
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // track in-flight updates per row
  const [updating, setUpdating] = useState(() => new Set());

  const canPrev = useMemo(() => q.page > 1, [q.page]);
  const canNext = useMemo(
    () => q.page * q.limit < total,
    [q.page, q.limit, total]
  );

  // --- fetch books whenever query changes ---
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setErr("");
      try {
        const data = await listBooks(q); // robust normalizer in api/books.js
        if (cancelled) return;
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setItems(list);
        setTotal(
          Number.isFinite(data?.total)
            ? data.total
            : Array.isArray(list)
            ? list.length
            : 0
        );
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setErr(typeof e === "string" ? e : e?.message || "Fehler beim Laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [q.page, q.limit, q.sortBy, q.order]);

  // --- helpers ---
  function setQuery(patch) {
    setQ((prev) => ({ ...prev, ...patch }));
  }
  function nextPage() {
    if (canNext) setQuery({ page: q.page + 1 });
  }
  function prevPage() {
    if (canPrev) setQuery({ page: q.page - 1 });
  }
  const rowId = (b) =>
    b?._id || b?.id || b?.barcode || b?.BMarkb || b?.BMark || "";

  // optimistic local replace for a row
  function patchRow(id, patch) {
    if (!id) return;
    setItems((prev) =>
      prev.map((it) => (rowId(it) === id ? { ...it, ...patch } : it))
    );
  }
  function setUpdatingOn(id, on = true) {
    setUpdating((prev) => {
      const n = new Set(prev);
      if (!id) return n;
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  // --- update actions ---
  async function toggleTop(b, nextVal) {
    const id = rowId(b);
    if (!id) return alert("Kein Datensatz-ID gefunden.");
    setUpdatingOn(id, true);
    const revert = { BTop: !!b?.BTop };
    try {
      patchRow(id, { BTop: !!nextVal }); // optimistic
      await updateBook(id, { BTop: !!nextVal });
    } catch (e) {
      patchRow(id, revert);
      alert(
        typeof e === "string" ? e : e?.message || "Update Topbook fehlgeschlagen"
      );
    } finally {
      setUpdatingOn(id, false);
    }
  }

  async function setStatus(b, nextStatus /* 'abandoned' | 'finished' */) {
    const id = rowId(b);
    if (!id) return alert("Kein Datensatz-ID gefunden.");
    setUpdatingOn(id, true);
    const revert = { status: b?.status ?? null };
    try {
      patchRow(id, { status: nextStatus }); // optimistic
      await updateBook(id, { status: nextStatus });
    } catch (e) {
      patchRow(id, revert);
      alert(
        typeof e === "string"
          ? e
          : e?.message || "Update Status (abandoned/finished) fehlgeschlagen"
      );
    } finally {
      setUpdatingOn(id, false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Bücher verwalten</h1>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            Sortieren nach
            <select
              className="border rounded p-1"
              value={q.sortBy}
              onChange={(e) => setQuery({ sortBy: e.target.value, page: 1 })}
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
              onChange={(e) => setQuery({ order: e.target.value, page: 1 })}
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
              onChange={(e) =>
                setQuery({ limit: Number(e.target.value), page: 1 })
              }
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
        Seite <strong>{q.page}</strong> • Einträge pro Seite{" "}
        <strong>{q.limit}</strong> • Gesamt <strong>{total}</strong>
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
                <Th label="Topbook" />
                <Th label="Abandoned" />
                <Th label="Finished" />
                <Th label="Erstellt" />
                <Th label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {(items || []).map((b) => {
                const id = rowId(b);
                const isBusy = updating.has(id);
                const status = String(b?.status || "").toLowerCase();
                const isAbandoned = status === "abandoned";
                const isFinished = status === "finished";
                return (
                  <tr key={id} className="border-t align-top">
                    <Td>{b?.barcode || b?.BMarkb || b?.BMark || "—"}</Td>
                    <Td>{b?.BAutor || "—"}</Td>
                    <Td>{b?.BKw || "—"}</Td>
                    <Td>{b?.BVerlag || "—"}</Td>
                    <Td>
                      {Number.isFinite(b?.BSeiten) ? Number(b.BSeiten) : "—"}
                    </Td>
                    <Td>{b?.BTop ? "✓" : "—"}</Td>
                    <Td>{isAbandoned ? "✓" : "—"}</Td>
                    <Td>{isFinished ? "✓" : "—"}</Td>
                    <Td>
                      {b?.BEind ? new Date(b.BEind).toLocaleString() : "—"}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        {/* Toggle Topbook */}
                        <button
                          disabled={isBusy}
                          onClick={() => toggleTop(b, !b?.BTop)}
                          className="px-2 py-1 border rounded disabled:opacity-50"
                          title={b?.BTop ? "Topbook entfernen" : "Als Topbook markieren"}
                        >
                          {b?.BTop ? "★ Top entfernen" : "☆ Top setzen"}
                        </button>

                        {/* Status radio group (no Clear) */}
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name={`status-${id}`}
                              disabled={isBusy}
                              checked={isAbandoned}
                              onChange={() => setStatus(b, "abandoned")}
                            />
                            Abandoned
                          </label>
                          <label className="inline-flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name={`status-${id}`}
                              disabled={isBusy}
                              checked={isFinished}
                              onChange={() => setStatus(b, "finished")}
                            />
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
          Seite {q.page} / {Math.max(1, Math.ceil((total || 0) / q.limit))}
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
