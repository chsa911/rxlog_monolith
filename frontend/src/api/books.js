// frontend/src/api/books.js
import { API_BASE } from "./config";

/* ---------------- url + fetch helpers ---------------- */

function buildUrl(path) {
  // absolute URL passthrough
  if (/^https?:\/\//i.test(path)) return path;

  // choose base: env or sensible default for dev
  const baseRaw =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE)) ||
    API_BASE ||
    "http://localhost:4000/api";

  const base = String(baseRaw).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;

  // avoid /api/api when both sides carry /api
  if (base.endsWith("/api") && p.startsWith("/api/")) {
    return `${base}${p.slice(4)}`; // drop leading /api
  }
  return `${base}${p}`;
}

async function http(path, { method = "GET", json, signal } = {}) {
  const opts = {
    method,
    cache: "no-store", // avoid 304 during dev
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : undefined,
    signal,
    credentials: "include",
  };

  const url = buildUrl(path);
  let res = await fetch(url, opts);

  // Treat 304 like a cache miss; retry once
  if (res.status === 304) {
    res = await fetch(url, { ...opts, cache: "reload" });
  }

  const text = await res.text();
  if (!res.ok) {
    let msg = text || `HTTP ${res.status}`;
    try {
      const j = text ? JSON.parse(text) : null;
      msg = j?.message || j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/* ---------------- results normalizer ---------------- */

function normalize(d) {
  let items =
    d?.items ??
    d?.data ??
    d?.results ??
    d?.rows ??
    d?.docs ??
    d?.books ??
    (Array.isArray(d) ? d : []);
  if (!Array.isArray(items)) items = [];

  const total =
    Number(d?.total) ??
    Number(d?.count) ??
    Number(d?.totalCount) ??
    Number(d?.hits) ??
    items.length;

  return { items, total };
}

/* ---------------- listing helpers ---------------- */

function toQuery(params = {}) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    s.append(k, String(v));
  }
  return s.toString();
}

function buildListQS(params = {}) {
  const { page = 1, limit = 20, sortBy = "BEind", order = "desc", q } = params;
  const base = {
    page,
    limit,
    sort: sortBy,
    sortBy,
    order,
    direction: order,
    dir: order === "asc" ? 1 : -1,
  };
  if (q && String(q).trim()) base.q = String(q).trim(); // send just 'q'
  return toQuery(base);
}

async function tryList(pathBase, params) {
  const qs = buildListQS(params);
  const data = await http(`${pathBase}?${qs}`);
  const { items, total } = normalize(data);
  return { items, total, raw: data };
}

/* ---------------- public API ---------------- */

/**
 * List/search books with paging/sort.
 * Tries /books, /books/list, then /api/books (legacy).
 * Returns: { items, total, page, limit, raw, endpoint }
 */
export async function listBooks(params = {}) {
  const attempts = ["/books", "/books/list", "/api/books"];
  for (const base of attempts) {
    try {
      const res = await tryList(base, params);
      if (
        res.total > 0 ||
        Array.isArray(res.raw) ||
        Array.isArray(res.raw?.items) ||
        Array.isArray(res.raw?.data) ||
        Array.isArray(res.raw?.docs) ||
        Array.isArray(res.raw?.books)
      ) {
        return {
          items: res.items,
          total: res.total,
          page: params.page || 1,
          limit: params.limit || 20,
          raw: res.raw,
          endpoint: base,
        };
      }
    } catch {
      // try next
    }
  }

  // Final fallback: GET /books with no params
  const raw = await http(`/books`);
  const { items, total } = normalize(raw);
  return {
    items,
    total,
    page: params.page || 1,
    limit: params.limit || 20,
    raw,
    endpoint: "/books (no params)",
  };
}

// Back-compat: allow import { fetchBooks } ...
export { listBooks as fetchBooks };

/* --------- updates & other endpoints --------- */

export async function updateBook(id, patch) {
  if (!id) throw new Error("Missing book id");
  return http(`/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: patch || {},
  });
}

export async function autocomplete(field, value) {
  const qs = toQuery({ field, q: value });
  return http(`/books/autocomplete?${qs}`);
}

export async function registerBook(payload) {
  return http(`/books`, { method: "POST", json: payload });
}
