// frontend/src/api/bmarks.js
import { API_BASE } from "./config";

/** Preview first available barcode for width/height.
 * Returns: { firstCode, prefix, available }
 */
export async function previewBySize(BBreite, BHoehe) {
  // Build the base ("" in dev so Vite proxy handles /api)
  const base = (API_BASE && API_BASE.trim()) || "";

  // Build query string safely
  const qs = new URLSearchParams({
    BBreite: String(BBreite).replace(",", "."),
    BHoehe:  String(BHoehe).replace(",", "."),
  }).toString();

  // When base === "", this is just "/api/…", which fetch() accepts
  const url = `${base}/api/bmarks/preview-by-size?${qs}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const first = items[0];

  return {
    firstCode: first?.BMark || null,
    prefix: data?.prefix ?? null,
    available: typeof data?.available === "number" ? data.available : items.length,
  };
}
