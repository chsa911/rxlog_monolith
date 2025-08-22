// backend/utils/prefixFromSize.js

// --- parsing helpers (CM ONLY) ---
function num(v) {
  if (v == null) return null;
  const s = String(v).replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Inputs are already in centimeters — no unit conversion.
function cm(v) {
  return num(v);  // leave as-is (cm)
}

// --- comparisons with tiny epsilon for boundary safety ---
const EPS = 1e-9;
const lt  = (x, b) => x <  b + EPS;
const lte = (x, b) => x <= b + EPS;
const gt  = (x, a) => x >  a - EPS;
const gte = (x, a) => x >= a - EPS;

// exact-height “equals” set
const E = [20.5, 21.0, 21.5];
const isOneOf = (h, arr) => arr.some(x => Math.abs(h - x) < EPS);

// --- ORDERED rule table (width buckets in order; bands in order) ---
const RULES = [
  // size 0
  { w: w => lte(w, 10.5), bands: [
    { type:'lt',  val:17.5, prefix:['egk'] },
    { type:'eqs', vals:E,   prefix:['lgk'] },
    { type:'gt',  val:17.5, prefix:['ogk'] },
  ]},
  // size 1
  { w: w => w > 10.5 && lte(w, 11.3), bands: [
    { type:'lt',  val:18,   prefix:['eak'] },
    { type:'eqs', vals:E,   prefix:['lak'] },
    { type:'gt',  val:18,   prefix:['oak'] },
  ]},
  // size 2
  { w: w => w > 11.3 && lte(w, 11.4), bands: [
    { type:'lt',  val:18,   prefix:['ekb'] },
  ]},
  // size 3
  { w: w => w > 11.4 && w < 11.8, bands: [
    { type:'lte', val:18,   prefix:['eb'] },
    { type:'eqs', vals:E,   prefix:['lb'] },
    { type:'gt',  val:18,   prefix:['ob'] },
  ]},
  // size 4
  { w: w => gte(w, 11.8) && lte(w, 11.9), bands: [
    { type:'lt',  val:19,   prefix:['ekg'] },
  ]},
  // size 5
  { w: w => w > 11.9 && w < 12.3, bands: [
    { type:'lte', val:18.5, prefix:['es'] },
    { type:'eqs', vals:E,   prefix:['ls'] },
    { type:'gt',  val:18.5, prefix:['os'] },
  ]},
  // size 6
  { w: w => gte(w, 12.3) && lte(w, 12.4), bands: [
    { type:'lt',  val:19,   prefix:['eki'] },
  ]},
  // size 7  (fallback oi → oik)
  { w: w => w > 12.4 && lte(w, 12.5), bands: [
    { type:'lt',  val:19,   prefix:['ei'] },
    { type:'eqs', vals:E,   prefix:['li'] },
    { type:'gt',  val:19,   prefix:['oi','oik'] },
  ]},
  // size 8
  { w: w => w > 12.5 && lte(w, 13), bands: [
    { type:'lte', val:20,   prefix:['ek'] },
    { type:'eqs', vals:E,   prefix:['lk'] },
    { type:'gt',  val:20,   prefix:['ok'] },
  ]},
  // size 9
  { w: w => w > 13 && lte(w, 13.4), bands: [
    { type:'lt',  val:21,   prefix:['ekn'] },
  ]},
  // size 10
  { w: w => w > 13 && lte(w, 13.5), bands: [
    { type:'lt',  val:20.5, prefix:['en'] },
    { type:'eqs', vals:E,   prefix:['ln'] },
    { type:'gt',  val:21.5, prefix:['ogk'] },
  ]},
  // size 11
  { w: w => w > 13.4 && lte(w, 14), bands: [
    { type:'lt',  val:20.5, prefix:['egk'] },
    { type:'eqs', vals:E,   prefix:['lgk'] },
    { type:'gt',  val:21.5, prefix:['ogk'] },
  ]},
  // size 12
  { w: w => w > 14 && lte(w, 14.5), bands: [
    { type:'lt',  val:20.5, prefix:['ep'] },
    { type:'eqs', vals:E,   prefix:['lp'] },
    { type:'gt',  val:21.5, prefix:['op'] },
  ]},
  // size 13
  { w: w => w > 14.5 && lte(w, 15), bands: [
    { type:'lt',  val:20.5, prefix:['eg'] },
    { type:'eqs', vals:E,   prefix:['lg'] },
    { type:'gt',  val:21.5, prefix:['og'] },
  ]},
  // size 14
  { w: w => w > 15 && lte(w, 15.5), bands: [
    { type:'lt',  val:22,   prefix:['epk'] },
    { type:'eqs', vals:E,   prefix:['lpk'] },
    { type:'gt',  val:22,   prefix:['opk'] },
  ]},
  // size 15
  { w: w => w > 15.5 && lte(w, 17.3), bands: [
    { type:'lt',  val:23,   prefix:['ekt'] },
  ]},
  // size 16
  { w: w => w > 17.3 && lte(w, 17.5), bands: [
    { type:'lt',  val:23,   prefix:['et'] },
    { type:'eqs', vals:E,   prefix:['lt'] },
    { type:'gt',  val:23,   prefix:['ot'] },
  ]},
  // size 17
  { w: w => w > 17.5 && lte(w, 22.5), bands: [
    { type:'lt',  val:23,   prefix:['etk'] },
    { type:'eqs', vals:E,   prefix:['ltk'] },
    { type:'gt',  val:23,   prefix:['otk'] },
  ]},
  // size 18
  { w: w => w > 22.5 && lte(w, 24), bands: [
    { type:'lt',  val:28,   prefix:['eu'] },
    { type:'eqs', vals:E,   prefix:['lu'] },
    { type:'gt',  val:28,   prefix:['ou'] },
  ]},
  // size 19
  { w: w => w > 24 && lte(w, 24.5), bands: [
    { type:'lt',  val:29,   prefix:['euk'] },
    { type:'eqs', vals:E,   prefix:['luk'] },
    { type:'gt',  val:29,   prefix:['ouk'] },
  ]},
  // size 20
  { w: w => w > 24.5 && lte(w, 27), bands: [
    { type:'lt',  val:32,   prefix:['eyk'] },
    { type:'eqs', vals:E,   prefix:['lyk'] },
    { type:'gt',  val:32,   prefix:['oyk'] },
  ]},
];

// --- main function ---
function prefixFromSize(BBreiteRaw, BHoeheRaw, debug=false) {
  const w = cm(BBreiteRaw), h = cm(BHoeheRaw);
  if (w == null || h == null) {
    if (debug) console.log('[prefixFromSize] invalid input', { BBreiteRaw, BHoeheRaw, w, h });
    return null;
  }

  for (const r of RULES) {
    if (!r.w(w)) continue;

    // check bands in the given order: eqs → lt/lte → gt (as encoded)
    for (const b of r.bands) {
      if (b.type === 'eqs' && isOneOf(h, b.vals)) {
        if (debug) console.log('[prefixFromSize] match eqs', { w, h, candidates: b.prefix });
        return b.prefix;
      }
      if (b.type === 'lt'  && lt(h,  b.val)) {
        if (debug) console.log('[prefixFromSize] match lt',  { w, h, candidates: b.prefix });
        return b.prefix;
      }
      if (b.type === 'lte' && lte(h, b.val)) {
        if (debug) console.log('[prefixFromSize] match lte', { w, h, candidates: b.prefix });
        return b.prefix;
      }
      if (b.type === 'gt'  && gt(h,  b.val)) {
        if (debug) console.log('[prefixFromSize] match gt',  { w, h, candidates: b.prefix });
        return b.prefix;
      }
    }
    if (debug) console.log('[prefixFromSize] width matched but no height band', { w, h });
    return null;
  }

  if (debug) console.log('[prefixFromSize] no width rule', { w, h });
  return null;
}

module.exports = prefixFromSize;
