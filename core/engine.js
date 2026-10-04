/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — core/engine.js
   MP4 metadata patching engine.
   © 2026 ReyyTools · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   MODULE STATE
   ═══════════════════════════════════════════════════════════════ */

let _activeVideo = null;
let _activeMode  = 'patch';
let _activeScale = '2';

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — FILE / MODE HANDLERS (called from ui/app.js)
   ═══════════════════════════════════════════════════════════════ */

function attachVideoFile(file) { _activeVideo = file; }
function setActiveMode(mode)   { _activeMode = mode; }
function setActiveScale(scale) { _activeScale = scale; }

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — MAIN PATCH PIPELINE
   ═══════════════════════════════════════════════════════════════ */

async function runPatchPipeline() {
  if (!_activeVideo) throw new Error('No video loaded');

  const t0 = Date.now();
  const startSize = _activeVideo.size;
  const baseName = _activeVideo.name.replace(/\.[^/.]+$/, '');

  setState('patch_state', 'patch_state_text', 'Reading file…', 'working');
  setMeter('patch_meter', 'patch_meter_fill', 10, 'Loading');

  const buf = await _activeVideo.arrayBuffer();
  const ab = new Uint8Array(buf).buffer;

  if (!isMp4Buffer(new Uint8Array(ab))) {
    throw new Error('File is not a valid MP4');
  }

  setMeter('patch_meter', 'patch_meter_fill', 30, 'Patching metadata');

  let output;
  if (_activeMode === 'patch') {
    output = patchSignature(ab);
  } else if (_activeMode === 'boost60') {
    output = patchSignature(ab, { boostHint: true });
  } else if (_activeMode === 'speed') {
    output = patchSignature(ab, { speedScale: _activeScale });
  } else {
    output = patchSignature(ab);
  }

  setMeter('patch_meter', 'patch_meter_fill', 85, 'Preparing download');

  const outSize = output.byteLength || output.length;
  const filename = baseName + '_' + _activeMode + '_reyytools.mp4';

  downloadAs(output, filename);

  setMeter('patch_meter', 'patch_meter_fill', 100, 'Complete');
  setState('patch_state', 'patch_state_text', 'Done', 'success');

  const elapsed = (Date.now() - t0) / 1000;
  if (typeof showReport === 'function') {
    showReport(_activeVideo.name, elapsed, startSize, outSize);
  }
  if (typeof recordUsage === 'function') {
    recordUsage('patch');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — MAIN ENCODE PIPELINE
   ═══════════════════════════════════════════════════════════════ */

async function runEncodePipeline() {
  if (!_activeVideo) throw new Error('No video loaded');
  if (typeof loadFFmpeg !== 'function') throw new Error('Encoder engine not ready');

  const t0 = Date.now();
  const startSize = _activeVideo.size;
  const baseName = _activeVideo.name.replace(/\.[^/.]+$/, '');

  const codec  = (document.getElementById('enc_codec')  || {}).value || 'libx264';
  const crf    = (document.getElementById('enc_crf')    || {}).value || '18';
  const preset = (document.getElementById('enc_preset') || {}).value || 'medium';
  const stamp  = (document.getElementById('enc_sig') || {}).checked !== false;

  setState('enc_state', 'enc_state_text', 'Loading FFmpeg…', 'working');
  setMeter('enc_meter', 'enc_meter_fill', 5, 'Booting engine');

  const ff = await loadFFmpeg();

  setMeter('enc_meter', 'enc_meter_fill', 15, 'Writing input');
  ff.FS('writeFile', 'input.mp4', new Uint8Array(await _activeVideo.arrayBuffer()));

  setMeter('enc_meter', 'enc_meter_fill', 30, 'Encoding…');

  const args = ['-i', 'input.mp4', '-c:v', codec, '-crf', crf, '-preset', preset, '-c:a', 'copy'];

  ff.setLogger(() => {});
  ff.setProgress(({ ratio }) => {
    if (ratio >= 0 && ratio <= 1) {
      setMeter('enc_meter', 'enc_meter_fill', 30 + Math.round(ratio * 50), 'Encoding ' + Math.round(ratio * 100) + '%');
    }
  });

  await ff.run.apply(null, args.concat(['enc_out.mp4']));

  ff.setProgress(() => {});
  ff.setLogger(() => {});

  setMeter('enc_meter', 'enc_meter_fill', 85, 'Finalizing');

  const encData = ff.FS('readFile', 'enc_out.mp4');
  let ab = encData.buffer.slice(encData.byteOffset, encData.byteOffset + encData.byteLength);

  if (stamp) {
    setMeter('enc_meter', 'enc_meter_fill', 92, 'Applying signature');
    ab = patchSignature(ab);
  }

  try { ff.FS('unlink', 'input.mp4'); } catch (e) {}
  try { ff.FS('unlink', 'enc_out.mp4'); } catch (e) {}

  const outSize = ab.byteLength || ab.length;
  downloadAs(ab, baseName + '_crf' + crf + '_reyytools.mp4');

  setMeter('enc_meter', 'enc_meter_fill', 100, 'Complete');
  setState('enc_state', 'enc_state_text', 'Done', 'success');

  const elapsed = (Date.now() - t0) / 1000;
  if (typeof showReport === 'function') {
    showReport(_activeVideo.name, elapsed, startSize, outSize);
  }
  if (typeof recordUsage === 'function') {
    recordUsage('encode');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — MP4 SIGNATURE PATCH (CORE)
   ═══════════════════════════════════════════════════════════════ */

function patchSignature(srcBuffer, opts) {
  opts = opts || {};

  const buf = srcBuffer instanceof ArrayBuffer ? srcBuffer : srcBuffer.buffer;
  const arr = new Uint8Array(buf.slice(0));
  const dv  = new DataView(arr.buffer);

  const atoms    = scanAtoms(arr, dv, 0, arr.length);
  const ftypAtom = pickTop(atoms, 'ftyp');
  const moovAtom = pickTop(atoms, 'moov');
  const mdatAtom = pickTop(atoms, 'mdat');

  if (!moovAtom) throw new Error('moov not found');
  if (!mdatAtom) throw new Error('mdat not found');

  const repl = new Map();

  const mvhdAtom = pickChild(moovAtom, 'mvhd');
  if (!mvhdAtom) throw new Error('mvhd not found');
  repl.set(mvhdAtom, rebuildMvhd(arr, dv, mvhdAtom));

  const allStco = [];
  for (let i = 0; i < moovAtom.children.length; i++) {
    const trak = moovAtom.children[i];
    if (trak.type !== 'trak') continue;
    const stbl = pickDeep(trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;
    const stco = pickChild(stbl, 'stco');
    if (stco) allStco.push(stco);
  }

  const sigUdta = buildSignatureUdta(opts);
  const existingUdta = pickChild(moovAtom, 'udta');

  if (existingUdta) {
    repl.set(existingUdta, sigUdta);
  } else {
    repl.set('__appendUdta__', sigUdta);
  }

  for (let i = 0; i < allStco.length; i++) {
    const co = allStco[i];
    repl.set(co, rebuildStco(scanStco(co), 0));
  }

  const ftypBytes = ftypAtom ? sliceAtomRaw(ftypAtom) : new Uint8Array(0);
  const moov1 = rebuildTree(arr, moovAtom, repl);

  repl.delete('__appendUdta__');

  const newMdatStart = ftypBytes.length + moov1.length + 8;
  const oldMdatStart = mdatAtom.contentStart;
  const delta = newMdatStart - oldMdatStart;

  for (let i = 0; i < allStco.length; i++) {
    const co = allStco[i];
    repl.set(co, rebuildStco(scanStco(co), delta));
  }

  const moovFinal = rebuildTree(arr, moovAtom, repl);
  const mdatFull  = sliceAtomRaw(mdatAtom);
  const output    = mergeBytes([ftypBytes, moovFinal, mdatFull]);

  return output.buffer;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — TREE REBUILDER
   ═══════════════════════════════════════════════════════════════ */

function rebuildTree(arr, atom, repl) {
  if (repl.has(atom)) return repl.get(atom);
  if (!atom.children.length) return sliceAtomRaw(atom);

  const prefix = (atom.type === 'meta') ? arr.slice(atom.contentStart, atom.contentStart + 4) : new Uint8Array(0);
  const parts  = [prefix];

  for (let i = 0; i < atom.children.length; i++) {
    parts.push(rebuildTree(arr, atom.children[i], repl));
  }

  if (atom.type === 'moov' && repl.has('__appendUdta__')) {
    parts.push(repl.get('__appendUdta__'));
  }

  const body = mergeBytes(parts);
  const out  = new Uint8Array(8 + body.length);
  const dv   = new DataView(out.buffer);

  dv.setUint32(0, 8 + body.length, false);
  writeType(out, 4, atom.type);
  out.set(body, 8);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — MVHD REBUILD
   ═══════════════════════════════════════════════════════════════ */

function rebuildMvhd(arr, dv, atom) {
  const version = arr[atom.contentStart];

  if (version === 1) {
    const out = sliceAtomRaw(atom).slice();
    const odv = new DataView(out.buffer, out.byteOffset);
    odv.setUint32(32, 0xFFFFFFFF, false);
    odv.setUint32(36, 0xFFFFFFFF, false);
    return out;
  }

  const ct      = dv.getUint32(atom.contentStart + 4, false);
  const mt      = dv.getUint32(atom.contentStart + 8, false);
  const ts      = dv.getUint32(atom.contentStart + 12, false);
  const restSrc = atom.contentStart + 20;
  const restLen = atom.size - 8 - 20;
  const newSize = atom.size + 12;

  const out = new Uint8Array(newSize);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, newSize, false);
  writeType(out, 4, 'mvhd');

  out[8] = 1;

  odv.setUint32(12, 0, false);
  odv.setUint32(16, ct, false);
  odv.setUint32(20, 0, false);
  odv.setUint32(24, mt, false);
  odv.setUint32(28, ts, false);
  odv.setUint32(32, 0xFFFFFFFF, false);
  odv.setUint32(36, 0xFFFFFFFF, false);

  out.set(arr.slice(restSrc, restSrc + restLen), 40);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — STCO REBUILD
   ═══════════════════════════════════════════════════════════════ */

function rebuildStco(offsets, delta) {
  const body = new Uint8Array(4 + 4 + offsets.length * 4);
  const dv   = new DataView(body.buffer);

  dv.setUint32(4, offsets.length, false);

  let off = 8;
  for (let i = 0; i < offsets.length; i++) {
    dv.setUint32(off, (offsets[i] + delta) >>> 0, false);
    off += 4;
  }

  const out = new Uint8Array(8 + body.length);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, 8 + body.length, false);
  writeType(out, 4, 'stco');
  out.set(body, 8);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 — SIGNATURE UDTA BUILDER
   ═══════════════════════════════════════════════════════════════ */

function buildSignatureUdta(opts) {
  opts = opts || {};

  const today = new Date().toISOString().slice(0, 10);

  const tags = [
    buildTagAtom('\xa9nam', 'ReyyTools Patch'),
    buildTagAtom('\xa9cpy', '\u00A9 2026 ReyStecu'),
    buildTagAtom('\xa9too', 'ReyyTools Engine'),
    buildTagAtom('\xa9swr', 'ReyyTools v1.0.0'),
    buildTagAtom('\xa9prd', 'ReyStecu'),
    buildTagAtom('\xa9des', 'Optimized by ReyyTools'),
    buildTagAtom('\xa9cmt', 'Processed via ReyyTools \u2014 t.me/reyystecuu_bot'),
    buildTagAtom('\xa9day', today)
  ];

  const ilstBody = mergeBytes(tags);
  const ilst     = new Uint8Array(8 + ilstBody.length);
  const idv      = new DataView(ilst.buffer);
  idv.setUint32(0, 8 + ilstBody.length, false);
  writeType(ilst, 4, 'ilst');
  ilst.set(ilstBody, 8);

  const hdlr = buildHdlrAtom();

  const metaBody = mergeBytes([new Uint8Array(4), hdlr, ilst]);
  const meta     = new Uint8Array(8 + metaBody.length);
  const mdv      = new DataView(meta.buffer);
  mdv.setUint32(0, 8 + metaBody.length, false);
  writeType(meta, 4, 'meta');
  meta.set(metaBody, 8);

  const udta = new Uint8Array(8 + meta.length);
  const udv  = new DataView(udta.buffer);
  udv.setUint32(0, 8 + meta.length, false);
  writeType(udta, 4, 'udta');
  udta.set(meta, 8);

  return udta;
}

function buildTagAtom(fourCC, text) {
  const enc  = new TextEncoder();
  const tb   = enc.encode(text);
  const data = new Uint8Array(4 + 4 + 4 + 4 + tb.length);
  const ddv  = new DataView(data.buffer);

  ddv.setUint32(0, data.length, false);
  writeType(data, 4, 'data');
  ddv.setUint32(8, 1, false);
  ddv.setUint32(12, 0, false);
  data.set(tb, 16);

  const atom = new Uint8Array(4 + 4 + data.length);
  const bdv  = new DataView(atom.buffer);
  bdv.setUint32(0, atom.length, false);
  writeType(atom, 4, fourCC);
  atom.set(data, 8);
  return atom;
}

function buildHdlrAtom() {
  const bodyLen = 4 + 4 + 4 + 12 + 1;
  const body    = new Uint8Array(bodyLen);

  body[0] = 0; body[1] = 0; body[2] = 0; body[3] = 0;
  body[4] = 0; body[5] = 0; body[6] = 0; body[7] = 0;

  body[8]  = 0x6d; body[9]  = 0x64; body[10] = 0x69; body[11] = 0x72;
  body[12] = 0x61; body[13] = 0x70; body[14] = 0x70; body[15] = 0x6c;

  body[24] = 0;

  const atom = new Uint8Array(8 + bodyLen);
  const bdv  = new DataView(atom.buffer);
  bdv.setUint32(0, atom.length, false);
  writeType(atom, 4, 'hdlr');
  atom.set(body, 8);
  return atom;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9 — DOWNLOAD HELPER
   ═══════════════════════════════════════════════════════════════ */

function downloadAs(data, filename) {
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

console.log('[ReyyTools] engine.js loaded · © ReyStecu');