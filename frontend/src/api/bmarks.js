import API_BASE from "./config";

export async function previewBMark(prefix) {
  const res = await fetch(`${API_BASE}/api/bmarks/preview?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function previewBySize(BBreite, BHoehe) {
  const q = new URLSearchParams({ BBreite, BHoehe }).toString();
  const res = await fetch(`${API_BASE}/api/bmarks/preview-by-size?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // → { _id, BMark, rank } | null
}

export async function registerBook(payload) {
  const res = await fetch(`${API_BASE}/api/books/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
