/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — core/atoms.js
   Low-level MP4 atom helpers. Robust parser.
   © 2026 ReyyTools · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const CONTAINER_BOXES = new Set([
  'moov', 'trak', 'mdia', 'minf', 'stbl',
  'edts', 'dinf', 'udta', 'meta', 'ilst',
  'moof', 'traf', 'mvex', 'mfra'
]);

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — VALIDATION
   ═══════════════════════════════════════════════════════════════ */

function isMp4Buffer(data) {
  if (!data || data.length < 12) return false;
  const type = String.fromCharCode(data[4], data[5], data[6], data[7]);
  return type === 'ftyp' || type === 'moov' || type === 'mdat'
      || type === 'free' || type === 'wide';
}

function seekAtom(data, fourCC) {
  const c0 = fourCC.charCodeAt(0);
  const c1 = fourCC.charCodeAt(1);
  const c2 = fourCC.charCodeAt(2);
  const c3 = fourCC.charCodeAt(3);

  for (let i = 0; i <= data.length - 4; i++) {
    if (data[i]     === c0 &&
        data[i + 1] === c1 &&
        data[i + 2] === c2 &&
        data[i + 3] === c3) return i;
  }
  return -1;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — ATOM TYPE HELPERS
   ═══════════════════════════════════════════════════════════════ */

function readType(data, offset) {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function writeType(data, offset, type) {
  for (let i = 0; i < 4; i++) data[offset + i] = type.charCodeAt(i);
}

function guardU32(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) {
    throw new Error(label + ' out of uint32: ' + value);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — ATOM PARSING (ROBUST)
   ═══════════════════════════════════════════════════════════════ */

function sliceAtom(view, data, offset, end, parentPath) {
  if (offset + 8 > end) return null;

  const smallSize = view.getUint32(offset, false);
  const type      = readType(data, offset + 4);
  let size        = smallSize;
  let headerSize  = 8;

  if (smallSize === 1) {
    if (offset + 16 > end) return null;
    const high = view.getUint32(offset + 8,  false);
    const low  = view.getUint32(offset + 12, false);
    size       = high * 4294967296 + low;
    headerSize = 16;
  } else if (smallSize === 0) {
    size = end - offset;
  }

  if (size < headerSize) return null;
  if (offset + size > end) size = end - offset;
  if (size < headerSize) return null;

  return {
    type,
    offset,
    size,
    headerSize,
    contentStart: offset + headerSize,
    end:          offset + size,
    path:         parentPath ? (parentPath + '/' + type) : type,
    data,
    view,
    children: [],
    prefixStart:  offset + headerSize,
    prefixEnd:    offset + headerSize
  };
}

function innerStart(atom) {
  return atom.type === 'meta' ? atom.contentStart + 4 : atom.contentStart;
}

function scanAtoms(data, view, start, end, parentPath) {
  start = start || 0;
  end   = end || data.length;
  parentPath = parentPath || '';

  const atoms = [];
  let offset = start;

  while (offset + 8 <= end) {
    const atom = sliceAtom(view, data, offset, end, parentPath);
    if (!atom) break;

    if (CONTAINER_BOXES.has(atom.type)) {
      const cs = innerStart(atom);
      if (cs < atom.end) {
        atom.prefixStart = atom.contentStart;
        atom.prefixEnd   = cs;
        try {
          atom.children = scanAtoms(data, view, cs, atom.end, atom.path);
        } catch (e) {
          atom.children = [];
        }
      }
    }

    atoms.push(atom);
    if (atom.end <= atom.offset) break;
    offset = atom.end;
  }
  return atoms;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — ATOM TREE QUERIES
   ═══════════════════════════════════════════════════════════════ */

function pickChild(atom, type) {
  return atom.children.find(c => c.type === type) || null;
}

function pickDeep(atom, path) {
  let cur = atom;
  for (let i = 0; i < path.length; i++) {
    cur = pickChild(cur, path[i]);
    if (!cur) return null;
  }
  return cur;
}

function pickTop(atoms, type) {
  return atoms.find(b => b.type === type) || null;
}

function trackHandler(trak) {
  const hdlr = pickDeep(trak, ['mdia', 'hdlr']);
  if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
  return readType(hdlr.data, hdlr.offset + 16);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — SAMPLE TABLE SCANNERS
   ═══════════════════════════════════════════════════════════════ */

function scanStsz(stsz) {
  const sampleSize = stsz.view.getUint32(stsz.offset + 12, false);
  const count      = stsz.view.getUint32(stsz.offset + 16, false);

  if (sampleSize) {
    const arr = new Array(count);
    for (let i = 0; i < count; i++) arr[i] = sampleSize;
    return arr;
  }

  const ts = stsz.offset + 20;
  if (ts + count * 4 > stsz.end) return [];

  const sizes = [];
  for (let i = 0; i < count; i++) sizes.push(stsz.view.getUint32(ts + i * 4, false));
  return sizes;
}

function scanStco(stco) {
  const count = stco.view.getUint32(stco.offset + 12, false);
  const ts    = stco.offset + 16;
  if (ts + count * 4 > stco.end) return [];

  const offsets = [];
  for (let i = 0; i < count; i++) offsets.push(stco.view.getUint32(ts + i * 4, false));
  return offsets;
}

function scanStsc(stsc) {
  const count = stsc.view.getUint32(stsc.offset + 12, false);
  const ts    = stsc.offset + 16;
  if (ts + count * 12 > stsc.end) return [];

  const rows = [];
  for (let i = 0; i < count; i++) {
    const o = ts + i * 12;
    rows.push([
      stsc.view.getUint32(o,     false),
      stsc.view.getUint32(o + 4, false),
      stsc.view.getUint32(o + 8, false)
    ]);
  }
  return rows;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — ATOM BUILDERS
   ═══════════════════════════════════════════════════════════════ */

function wrapAtom(type, payload) {
  const size = 8 + payload.length;
  guardU32(size, type + '.size');

  const atom = new Uint8Array(size);
  const view = new DataView(atom.buffer);
  view.setUint32(0, size, false);
  writeType(atom, 4, type);
  atom.set(payload, 8);
  return atom;
}

function mergeBytes(parts) {
  let total = 0;
  for (let i = 0; i < parts.length; i++) total += parts[i].length;
  guardU32(total, 'output_size');

  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    out.set(parts[i], offset);
    offset += parts[i].length;
  }
  return out;
}

function sliceAtomRaw(atom)  { return atom.data.slice(atom.offset, atom.end); }
function sliceAtomBody(atom) { return atom.data.slice(atom.contentStart, atom.end); }

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — FASTSTART CHECK
   ═══════════════════════════════════════════════════════════════ */

function isFastStart(data) {
  if (!data || data.length < 8) return false;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 0;

  while (o + 8 <= data.length) {
    const sz = view.getUint32(o, false);
    const t  = String.fromCharCode(data[o + 4], data[o + 5], data[o + 6], data[o + 7]);

    if (t === 'moov') return true;
    if (t === 'mdat') return false;
    if (sz < 8 || o + sz > data.length) break;
    o += sz;
  }
  return false;
}

console.log('[ReyyTools] atoms.js loaded · © ReyStecu');