// frontend/src/api/books.js
import { API_BASE } from "./config";

/**
 * List books with pagination/sorting.
 * Always returns { page, limit, total, items: [] }.
 */
export async function listBooks(params = {}) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}/api/books?${qs}`, { method: "GET" });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const items =
    Array.isArray(data?.items) ? data.items :
    (Array.isArray(data) ? data : []);

  return {
    page: data?.page ?? 1,
    limit: data?.limit ?? items.length,
    total: data?.total ?? items.length,
    items
  };
}

// Alias for legacy imports
export async function fetchBooks(params = {}) {
  return listBooks(params);
}

/**
 * Register a new book. Backend requires `barcode` in payload.
 */
export async function registerBook(payload) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const res = await fetch(`${base}/api/books/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Autocomplete helper used by RegistrationForm.
 * Returns an array of strings (can be empty).
 */
export async function autocomplete(field, q) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const qs = new URLSearchParams({ field, q }).toString();
  const res = await fetch(`${base}/api/books/autocomplete?${qs}`, { method: "GET" });
  const data = await res.json().catch(() => ([]));
  if (!res.ok) return [];
  return Array.isArray(data) ? data : [];
}

// Optional default export if any file does `import api from './api/books'`
export default { listBooks, fetchBooks, registerBook, autocomplete };
