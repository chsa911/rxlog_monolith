// frontend/src/api/bmarks.js
import { API_BASE } from "./config";

const BMARKS_BASE = `${API_BASE}/api/bmarks`;
const BOOKS_BASE  = `${API_BASE}/api/books`;

/** Preview a BMark by prefix (GET /api/bmarks/preview?prefix=...) */
export async function previewBMark(prefix) {
  const url = new URL(`${BMARKS_BASE}/preview`, window.location.origin);
  if (prefix != null) url.searchParams.set("prefix", String(prefix));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Preview by size (GET /api/bmarks/preview-by-size?BBreite=&BHoehe=) */
export async function previewBySize(BBreite, BHoehe) {
  const url = new URL(`${BMARKS_BASE}/preview-by-size`, window.location.origin);
  if (BBreite != null) url.searchParams.set("BBreite", String(BBreite));
  if (BHoehe  != null) url.searchParams.set("BHoehe",  String(BHoehe));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { _id, BMark, rank } | null
}

/** Register a book (POST /api/books/register) */
export async function registerBook(payload) {
  const res = await fetch(`${BOOKS_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
