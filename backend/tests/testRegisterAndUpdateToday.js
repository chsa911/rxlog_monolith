// backend/tests/testRegisterAndUpdateToday.js
// Purpose: Ensure a book registered and updated *today* gets H/V and Top timestamps.
// Requires your backend running on http://localhost:4000 (or set API_BASE)
// Node 18+ recommended (has global fetch)
//
// Usage:
//   cd /Volumes/daten/rxapp/backend
//   node tests/testRegisterAndUpdateToday.js
//
// Env options:
//   API_BASE=http://localhost:4000/api  BOOK_ID=<existingId>  CLEANUP=1  node tests/testRegisterAndUpdateToday.js
//

const API = process.env.API_BASE || 'http://localhost:4000/api';
const CLI_ID = process.env.BOOK_ID || null;
const DO_CLEAN = /^(1|true|yes)$/i.test(String(process.env.CLEANUP || ''));

let _fetch = global.fetch;
if (!_fetch) {
  // Fallback for Node <18 if you have node-fetch installed
  _fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toDate(x) { return x ? new Date(x) : null; }
function isValidDate(d) { return d instanceof Date && !isNaN(d.getTime()); }

function now() { return new Date(); }
function isoDate(d) { return d.toISOString().slice(0,10); }

function withinMinutes(ts, minutes = 5) {
  const d = toDate(ts);
  if (!isValidDate(d)) return false;
  const diffMs = Math.abs(Date.now() - d.getTime());
  return diffMs <= minutes * 60 * 1000;
}

async function http(method, path, body) {
  const res = await _fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`❌ ${msg}`);
  console.log(`✔ ${msg}`);
}

async function ensureBookForToday() {
  if (CLI_ID) {
    console.log(`Using provided BOOK_ID=${CLI_ID}`);
    return CLI_ID;
  }
  console.log('No BOOK_ID provided — creating a fresh book for today...');
  try {
    const payload = {
      BBreite: 11.6,
      BHoehe: 19.0,
      BAutor: `Test-Register-${Date.now()}`,
      BKw: 'TimestampCheck',
      BKP: 1,
      BVerlag: 'Test-Verlag',
      BSeiten: 123,
    };
    const created = await http('POST', '/books/register', payload);
    console.log('✅ Created book:', created._id, created.BMarkb);
    return created._id;
  } catch (e) {
    if (String(e.message).includes('No free BMark')) {
      console.warn('⚠️  No free marks right now. Falling back to the latest book.');
      const list = await http('GET', '/books?limit=1&sort=BEind&order=desc');
      if (!list.data?.length) throw new Error('No books available to test against.');
      const id = list.data[0]._id;
      console.log('Using latest book:', id, list.data[0].BMarkb);
      return id;
    }
    throw e;
  }
}

async function run() {
  console.log('API_BASE =', API);

  const id = await ensureBookForToday();

  // 1) Baseline
  const before = await http('GET', `/books/${id}`);
  console.log('Baseline:', { BHVorV: before.BHVorV, BHVorVAt: before.BHVorVAt, BEind: before.BEind, BTop: before.BTop, BTopAt: before.BTopAt });

  // BEind should be "today" if we just created it (allow a small clock skew)
  if (before.BEind) {
    assert(withinMinutes(before.BEind, 10) || isoDate(new Date(before.BEind)) === isoDate(now()), 'BEind is today (freshly registered)');
  }

  // 2) Set H and expect BHVorVAt set (today)
  await http('PATCH', `/books/${id}`, { BHVorV: 'H' });
  const afterH = await http('GET', `/books/${id}`);
  assert(afterH.BHVorV === 'H', 'BHVorV should be H after update');
  assert(isValidDate(toDate(afterH.BHVorVAt)), 'BHVorVAt should exist after setting H');
  assert(withinMinutes(afterH.BHVorVAt, 5) || isoDate(new Date(afterH.BHVorVAt)) === isoDate(now()), 'BHVorVAt is from today (recent)');

  // 3) Toggle Top on, then off — timestamps should set/clear
  await http('PATCH', `/books/${id}`, { BTop: true });
  const topOn = await http('GET', `/books/${id}`);
  assert(!!topOn.BTop, 'BTop should be true after enabling');
  assert(isValidDate(toDate(topOn.BTopAt)), 'BTopAt should be set when BTop true');
  assert(withinMinutes(topOn.BTopAt, 5) || isoDate(new Date(topOn.BTopAt)) === isoDate(now()), 'BTopAt is from today (recent)');

  await sleep(300);
  await http('PATCH', `/books/${id}`, { BTop: false });
  const topOff = await http('GET', `/books/${id}`);
  assert(!topOff.BTop, 'BTop should be false after disabling');
  assert(topOff.BTopAt === null || typeof topOff.BTopAt === 'undefined', 'BTopAt cleared when BTop false');

  // 4) Optional cleanup
  if (DO_CLEAN) {
    await http('DELETE', `/books/${id}`);
    console.log('🧹 Deleted test book and returned its mark to the pool.');
  }

  console.log('\n✅ Test passed: registering and updating today stamps timestamps as expected.');
}

run().catch(err => {
  console.error('\n❌ Test failed:', err.message || err);
  process.exit(1);
});
