// backend/scripts/testUpdateTimestamps.js
// Node 18+ recommended (has global fetch)
// Usage:
//   node backend/scripts/testUpdateTimestamps.js                 # creates a temp book, runs tests
//   BOOK_ID=<existingId> node backend/scripts/testUpdateTimestamps.js   # test on a specific book
//   API_BASE=http://localhost:4000/api BOOK_ID=<id> node backend/scripts/testUpdateTimestamps.js

const API = process.env.API_BASE || 'http://localhost:4000/api';
const CLI_ID = process.env.BOOK_ID || process.argv[2] || null;

let _fetch = global.fetch;
if (!_fetch) {
  // Fallback for Node <18 if you have node-fetch installed
  _fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function toDate(x) { return x ? new Date(x) : null; }
function isValidDate(d) { return d instanceof Date && !isNaN(d.getTime()); }
function stamp() { return new Date().toISOString(); }

async function http(method, path, body) {
  const res = await _fetch(`${API}${path}` , {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

async function ensureBook() {
  if (CLI_ID) {
    console.log(`Using provided BOOK_ID=${CLI_ID}`);
    return CLI_ID;
  }
  console.log('No BOOK_ID provided. Attempting to create a temporary book...');
  try {
    const payload = {
      BBreite: 11.5,
      BHoehe: 19.0,
      BAutor: `Test HV ${Date.now()}`,
      BKw: 'Zeitstempel-Test',
      BKP: 1,
      BVerlag: 'Test-Verlag',
      BSeiten: 123,
    };
    const created = await http('POST', '/books/register', payload);
    console.log('✅ Created temp book:', created._id, created.BMarkb);
    return created._id;
  } catch (e) {
    if (String(e.message).includes('No free BMark')) {
      console.warn('⚠️  No free BMark — falling back to latest existing book');
      const list = await http('GET', '/books?limit=1&sort=BEind&order=desc');
      if (!list.data?.length) throw new Error('No books found in DB to test against. Seed/register one first.');
      const id = list.data[0]._id;
      console.log('Using latest book:', id, list.data[0].BMarkb);
      return id;
    }
    throw e;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`❌ ${msg}`);
  console.log(`✔ ${msg}`);
}

async function run() {
  console.log('API_BASE =', API);
  const id = await ensureBook();

  // 1) GET baseline
  const before = await http('GET', `/books/${id}`);
  console.log('Baseline BHVorV:', before.BHVorV, 'BHVorVAt:', before.BHVorVAt);

  // 2) Set H and expect BHVorVAt to be set
  console.log('\n[', stamp(), '] PATCH -> { BHVorV: "H" }');
  await http('PATCH', `/books/${id}`, { BHVorV: 'H' });
  const afterH = await http('GET', `/books/${id}`);
  assert(afterH.BHVorV === 'H', 'BHVorV should be "H" after update');
  const hAt = toDate(afterH.BHVorVAt);
  assert(isValidDate(hAt), 'BHVorVAt should be a valid timestamp after setting H');

  // 3) Wait then set V, expect BHVorVAt to move forward
  await sleep(1100);
  console.log('\n[', stamp(), '] PATCH -> { BHVorV: "V" }');
  await http('PATCH', `/books/${id}`, { BHVorV: 'V' });
  const afterV = await http('GET', `/books/${id}`);
  assert(afterV.BHVorV === 'V', 'BHVorV should be "V" after update');
  const vAt = toDate(afterV.BHVorVAt);
  assert(isValidDate(vAt), 'BHVorVAt should be a valid timestamp after setting V');
  assert(!hAt || vAt.getTime() >= hAt.getTime(), 'BHVorVAt should be same or later after second update');

  // 4) Toggle Top: true -> timestamp set
  console.log('\n[', stamp(), '] PATCH -> { BTop: true }');
  await http('PATCH', `/books/${id}`, { BTop: true });
  const afterTop = await http('GET', `/books/${id}`);
  assert(!!afterTop.BTop, 'BTop should be true');
  assert(isValidDate(toDate(afterTop.BTopAt)), 'BTopAt should be set when BTop is true');

  // 5) Toggle Top: false -> timestamp cleared
  console.log('\n[', stamp(), '] PATCH -> { BTop: false }');
  await http('PATCH', `/books/${id}`, { BTop: false });
  const afterTopOff = await http('GET', `/books/${id}`);
  assert(!afterTopOff.BTop, 'BTop should be false');
  assert(afterTopOff.BTopAt === null || afterTopOff.BTopAt === undefined, 'BTopAt should be null when BTop is false');

  console.log('\n✅ All timestamp tests passed on book', id);
}

run().catch(err => {
  console.error('\nTest failed:', err.message || err);
  process.exit(1);
});
