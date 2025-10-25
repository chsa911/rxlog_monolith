// frontend/src/api/bmarks.js
import { API_BASE } from "./config";

/** already present **/
export async function previewBySize(BBreite, BHoehe) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const qs = new URLSearchParams({
    BBreite: String(BBreite).replace(",", "."),
    BHoehe: String(BHoehe).replace(",", ".")
  }).toString();

  const res = await fetch(`${base}/api/bmarks/preview-by-size?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const items = Array.isArray(data.items) ? data.items : [];
  const first = items[0];
  return {
    firstCode: first?.BMark || null,
    prefix: data?.prefix ?? null,
    available:
      typeof data?.available === "number" ? data.available : items.length
  };
}

/** NEW: validate a specific barcode against the given size */
export async function validateForSize(BBreite, BHoehe, code) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const qs = new URLSearchParams({
    BBreite: String(BBreite).replace(",", "."),
    BHoehe: String(BHoehe).replace(",", "."),
    code: String(code ?? "").trim()
  }).toString();

  const res = await fetch(`${base}/api/bmarks/validate-for-size?${qs}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // backend returns { ok:false, reason:"..." } or { error:"..." }
    const msg = data?.reason || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  // Expected from backend: { ok: true, series: "..."} or { ok:false, reason:"..." }
  return data;
}
