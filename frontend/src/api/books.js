// frontend/src/api/books.js
import { API_BASE } from "./config";

const BOOKS_BASE = `${API_BASE}/api/books`;

/** List books with filters/pagination */
export async function listBooks(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${BOOKS_BASE}${query ? `?${query}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Generic partial update */
export async function updateBook(id, data) {
  const res = await fetch(`${BOOKS_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let msg = `Update failed (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
} catch (_) { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

/** Autocomplete
 * Backend route is usually: GET /api/books/autocomplete/:field?q=...
 * If your backend uses query param `field` instead, see the alternative below.
 */
export async function autocomplete(field, q = "") {
  const url = new URL(`${BOOKS_BASE}/autocomplete/${encodeURIComponent(field)}`);
  if (q) url.searchParams.set("q", q);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- Legacy compatibility wrappers ---------- */

export async function fetchBooks(params = {}) {
  return listBooks(params);
}

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

/* ---------- If your backend uses query param ?field= instead of /:field ----------

export async function autocomplete(field, q = "") {
  const url = new URL(`${BOOKS_BASE}/autocomplete`);
  url.searchParams.set("field", field);
  if (q) url.searchParams.set("q", q);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

----------------------------------------------------------------------- */
