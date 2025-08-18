import API_BASE from './config';

export async function fetchBooks(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/books?${query}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function autocomplete(field, q) {
  const res = await fetch(`${API_BASE}/api/books/autocomplete/${field}?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setTop(id, top) {
  const res = await fetch(`${API_BASE}/api/books/${id}/top`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ top }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setStatus(id, status) {
  const res = await fetch(`${API_BASE}/api/books/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
