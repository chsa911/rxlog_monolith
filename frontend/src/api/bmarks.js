import API_BASE from './config';

export async function previewBMark(prefix) {
  const res = await fetch(`${API_BASE}/api/bmarks/preview?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function registerBook(data) {
  const res = await fetch(`${API_BASE}/api/bmarks/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function releaseBMark(id) {
  const res = await fetch(`${API_BASE}/api/bmarks/${id}/release`, {
    method: 'PATCH'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
