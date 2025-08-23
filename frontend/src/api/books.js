// frontend/src/api/books.js
import API_BASE from "./config";

const BOOKS_BASE = `${API_BASE}/api/books`;

/** List books with filters/pagination (new name) */
export async function listBooks(params = {}) {
  const url = new URL(BOOKS_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.append(k, v);
    }
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { data, page, limit, total, pages }
}

/** Generic partial update */
export async function updateBook(id, data) {
  const res = await fetch(`${BOOKS_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let msg = "Fehler beim Update";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/** Autocomplete (matches backend: GET /api/books/autocomplete?field=...&q=...) */
export async function autocomplete(field, q) {
  const url = new URL(`${BOOKS_BASE}/autocomplete`);
  url.searchParams.set("field", field);
  url.searchParams.set("q", q || "");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- Compatibility exports for legacy imports ---------- */

/** Old name used in several components (wrapper around listBooks) */
export async function fetchBooks(params = {}) {
  return listBooks(params);
}

/** Old helpers used by BooksTable.jsx – wrap updateBook */
export async function setTop(id, top) {
  return updateBook(id, { BTop: !!top });
}

export async function setStatus(id, status) {
  // status: "historisiert" | "vorzeitig" | "none"
  if (status === "historisiert") {
    return updateBook(id, { BHistorisiert: true, BVorzeitig: false });
  }
  if (status === "vorzeitig") {
    return updateBook(id, { BHistorisiert: false, BVorzeitig: true });
  }
  return updateBook(id, { BHistorisiert: false, BVorzeitig: false });
}
