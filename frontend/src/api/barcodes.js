// frontend/src/api/barcodes.js
import { API_BASE } from "./config";

export async function previewBarcode(width, height) {
  const base = (API_BASE && API_BASE.trim()) || "";
  const qs = new URLSearchParams({ width: String(width), height: String(height) }).toString();
  const res = await fetch(`${base}/api/barcodes/preview-barcode?${qs}`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return { candidate: data?.candidate ?? null, series: data?.series ?? null };
}
