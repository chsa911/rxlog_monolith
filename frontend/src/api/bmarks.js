// frontend/src/api/bmarks.js
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function toQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (k === "BBreite" || k === "BHoehe") {
      q.set(k, String(v).trim().replace(",", "."));
    } else {
      q.set(k, v);
    }
  }
  // prevent 304 cache during dev
  q.set("_", Date.now().toString());
  return q.toString();
}

export async function previewBMark(prefix) {
  const url = `${API}/api/bmarks/preview?${toQuery({ prefix })}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`preview failed ${res.status}`);
  return res.json(); // null or { _id, BMark, rank }
}

export async function prefixBySize(BBreite, BHoehe) {
  const url = `${API}/api/bmarks/prefix-by-size?${toQuery({ BBreite, BHoehe })}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`prefix-by-size failed ${res.status}`);
  return res.json(); // { prefix } or { prefix: null }
}

export async function previewBySize(BBreite, BHoehe) {
  const url = `${API}/api/bmarks/preview-by-size?${toQuery({ BBreite, BHoehe })}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`preview-by-size failed ${res.status}`);
  return res.json(); // null or { _id, BMark, rank }
}

export async function registerBook(payload) {
  const url = `${API}/api/books/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `register failed ${res.status}`);
  }
  return res.json();
}
