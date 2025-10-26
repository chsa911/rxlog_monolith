// frontend/src/api/books.js
import { API_BASE } from "./config";

/* helpers */
function toQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.append(k, String(v));
  }
  return q.toString();
}

async function http(path, { method = "GET", json, signal } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : undefined,
    signal,
    credentials: "include", // keep if your backend uses cookies; otherwise remove it
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || `HTTP ${res.status}`;
    try {
      const j = text ? JSON.parse(text) : null;
      msg = j?.message || j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

/* normalize {items,total} from many shapes */
function normalize(d) {
  // if server returned HTML or string, this will be empty and we can debug raw later
  let items =
    d?.items ??
    d?.data ??
    d?.results ??
    d?.rows ??
    (Array.isArray(d) ? d : []);
  if (!Array.isArray(items)) items = [];
  const total =
    Number(d?.total) ??
    Number(d?.count) ??
    Number(d?.totalCount) ??
    items.length;
  return { items, total };
}

async function tryList(pathBase, params) {
  const { page = 1, limit = 20, sortBy = "BEind", order = "desc" } = params || {};
  const qs = toQuery({
    page, limit,
    sort: sortBy, sortBy,
    order, direction: order,
    dir: order === "asc" ? 1 : -1,
  });
  const data = await http(`${pathBase}?${qs}`);
  const { items, total } = normalize(data);
  return { items, total, raw: data };
}

/* ---- listBooks with multi-endpoint fallback ---- */
export async function listBooks(params = {}) {
  // Try /books -> /api/books -> /books/list
  const attempts = ["/books", "/api/books", "/books/list"];
  for (const base of attempts) {
    try {
      const res = await tryList(base, params);
      // Accept non-empty OR a response that at least looks like an array
      if (res.total > 0 || Array.isArray(res.raw) || Array.isArray(res.raw?.items) || Array.isArray(res.raw?.data)) {
        return { items: res.items, total: res.total, page: params.page || 1, limit: params.limit || 20, raw: res.raw, endpoint: base };
      }
    } catch (e) {
      // try next endpoint
      // console.warn(`Failed ${base}:`, e);
    }
  }

  // Final fallback: GET /books with no params at all
  try {
    const raw = await http(`/books`);
    const { items, total } = normalize(raw);
    return { items, total, page: params.page || 1, limit: params.limit || 20, raw, endpoint: "/books (no params)" };
  } catch (e) {
    throw e;
  }
}

/* Back-compat alias */
export { listBooks as fetchBooks };

/* updates */
export async function updateBook(id, patch) {
  if (!id) throw new Error("Missing book id");
  // If your backend expects a different route or method, adjust here.
  return http(`/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: patch || {},
  });
}

/* other APIs used elsewhere */
export async function autocomplete(field, value) {
  const qs = toQuery({ field, q: value });
  return http(`/books/autocomplete?${qs}`);
}
export async function registerBook(payload) {
  return http(`/books`, { method: "POST", json: payload });
}
