/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — api/worker.js
   Vercel serverless function: serves the browser-side MP4 engine.
   © 2026 ReyyTools · v1.0 · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const BROWSER_ENGINE = `(function(){
  'use strict';

  const CONTAINER_BOXES = new Set([
    'moov', 'trak', 'mdia', 'minf', 'stbl',
    'edts', 'dinf', 'udta', 'meta', 'ilst',
    'moof', 'traf', 'mvex', 'mfra'
  ]);

  function u32(dv, o)        { return dv.getUint32(o, false); }
  function w32(dv, o, v)     { dv.setUint32(o, v >>> 0, false); }
  function fcc(arr, o)       { return String.fromCharCode(arr[o], arr[o+1], arr[o+2], arr[o+3]); }
  function setFcc(arr, o, s) { for (let i = 0; i < 4; i++) arr[o + i] = s.charCodeAt(i); }

  function join(arrays) {
    let total = 0;
    for (let i = 0; i < arrays.length; i++) total += arrays[i].length;
    const out = new Uint8Array(total);
    let off = 0;
    for (let i = 0; i < arrays.length; i++) {
      out.set(arrays[i], off);
      off += arrays[i].length;
    }
    return out;
  }

  function parseBoxes(arr, dv, start, end) {
    const list = [];
    let off = start;
    while (off + 8 <= end) {
      let size = u32(dv, off);
      const type = fcc(arr, off + 4);
      let hdr = 8;

      if (size === 1) {
        if (off + 16 > end) break;
        size = u32(dv, off + 8) * 0x100000000 + u32(dv, off + 12);
        hdr = 16;
      } else if (size === 0) {
        size = end - off;
      }

      if (size < hdr) break;
      if (off + size > end) size = end - off;
      if (size < hdr) break;

      const cs  = off + hdr;
      const box = { type: type, off: off, size: size, hdr: hdr, cs: cs, end: off + size, children: [] };

      if (CONTAINER_BOXES.has(type)) {
        const innerStart = (type === 'meta') ? cs + 4 : cs;
        try { box.children = parseBoxes(arr, dv, innerStart, box.end); }
        catch (e) { box.children = []; }
      }

      list.push(box);
      if (box.end <= box.off) break;
      off += size;
    }
    return list;
  }

  function findBox(list, type) {
    for (let i = 0; i < list.length; i++) if (list[i].type === type) return list[i];
    return null;
  }

  function findPath(list, path) {
    let node = list;
    let res  = null;
    for (let i = 0; i < path.length; i++) {
      const b = findBox(node, path[i]);
      if (!b) return null;
      res  = b;
      node = b.children;
    }
    return res;
  }

  function rawOf(arr, box) { return arr.slice(box.off, box.end); }

  function readStco(arr, dv, box) {
    const cnt = u32(dv, box.cs + 4);
    const out = [];
    for (let i = 0; i < cnt; i++) out.push(u32(dv, box.cs + 8 + i * 4));
    return out;
  }

  function buildStco(offsets, delta) {
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
    setFcc(out, 4, 'stco');
    out.set(body, 8);
    return out;
  }

  function buildMvhd(arr, dv, box) {
    const v = arr[box.cs];
    if (v === 1) {
      const out = rawOf(arr, box).slice();
      const odv = new DataView(out.buffer);
      odv.setUint32(32, 0xFFFFFFFF, false);
      odv.setUint32(36, 0xFFFFFFFF, false);
      return out;
    }

    const ct      = u32(dv, box.cs + 4);
    const mt      = u32(dv, box.cs + 8);
    const ts      = u32(dv, box.cs + 12);
    const restSrc = box.cs + 20;
    const restLen = box.size - 8 - 20;
    const newSize = box.size + 12;

    const out = new Uint8Array(newSize);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, newSize, false);
    setFcc(out, 4, 'mvhd');

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

  function buildTagBox(fourCC, text) {
    const enc  = new TextEncoder();
    const tb   = enc.encode(text);
    const data = new Uint8Array(4 + 4 + 4 + 4 + tb.length);
    const ddv  = new DataView(data.buffer);

    ddv.setUint32(0, data.length, false);
    setFcc(data, 4, 'data');
    ddv.setUint32(8, 1, false);
    ddv.setUint32(12, 0, false);
    data.set(tb, 16);

    const box = new Uint8Array(4 + 4 + data.length);
    const bdv = new DataView(box.buffer);
    bdv.setUint32(0, box.length, false);
    setFcc(box, 4, fourCC);
    box.set(data, 8);
    return box;
  }

  function buildHdlrBox() {
    const bodyLen = 4 + 4 + 4 + 12 + 1;
    const body    = new Uint8Array(bodyLen);
    body[0] = 0; body[1] = 0; body[2] = 0; body[3] = 0;
    body[4] = 0; body[5] = 0; body[6] = 0; body[7] = 0;
    body[8]  = 0x6d; body[9]  = 0x64; body[10] = 0x69; body[11] = 0x72;
    body[12] = 0x61; body[13] = 0x70; body[14] = 0x70; body[15] = 0x6c;
    body[24] = 0;

    const box = new Uint8Array(8 + bodyLen);
    const bdv = new DataView(box.buffer);
    bdv.setUint32(0, box.length, false);
    setFcc(box, 4, 'hdlr');
    box.set(body, 8);
    return box;
  }

  function buildSignatureUdta() {
    const today = new Date().toISOString().slice(0, 10);

    const tags = [
      buildTagBox('\\xa9nam', 'ReyyTools Patch'),
      buildTagBox('\\xa9cpy', '\\u00A9 2026 ReyStecu'),
      buildTagBox('\\xa9too', 'ReyyTools Engine'),
      buildTagBox('\\xa9swr', 'ReyyTools v1.0'),
      buildTagBox('\\xa9prd', 'ReyStecu'),
      buildTagBox('\\xa9des', 'Optimized by ReyyTools'),
      buildTagBox('\\xa9cmt', 'Processed via ReyyTools \\u2014 t.me/reyystecuu_bot'),
      buildTagBox('\\xa9day', today)
    ];

    const ilstBody = join(tags);
    const ilst     = new Uint8Array(8 + ilstBody.length);
    const idv      = new DataView(ilst.buffer);
    idv.setUint32(0, 8 + ilstBody.length, false);
    setFcc(ilst, 4, 'ilst');
    ilst.set(ilstBody, 8);

    const hdlr = buildHdlrBox();

    const metaBody = join([new Uint8Array(4), hdlr, ilst]);
    const meta     = new Uint8Array(8 + metaBody.length);
    const mdv      = new DataView(meta.buffer);
    mdv.setUint32(0, 8 + metaBody.length, false);
    setFcc(meta, 4, 'meta');
    meta.set(metaBody, 8);

    const udta = new Uint8Array(8 + meta.length);
    const udv  = new DataView(udta.buffer);
    udv.setUint32(0, 8 + meta.length, false);
    setFcc(udta, 4, 'udta');
    udta.set(meta, 8);

    return udta;
  }

  function reyyPatchMP4(srcBuf) {
    const buf = srcBuf instanceof ArrayBuffer ? srcBuf : srcBuf.buffer;
    const arr = new Uint8Array(buf.slice(0));
    const dv  = new DataView(arr.buffer);

    const boxes   = parseBoxes(arr, dv, 0, arr.length);
    const ftypBox = findBox(boxes, 'ftyp');
    const moovBox = findBox(boxes, 'moov');
    const mdatBox = findBox(boxes, 'mdat');

    if (!moovBox) throw new Error('moov not found');
    if (!mdatBox) throw new Error('mdat not found');

    const repl = new Map();

    const mvhdBox = findBox(moovBox.children, 'mvhd');
    if (mvhdBox) repl.set(mvhdBox, buildMvhd(arr, dv, mvhdBox));

    const allStco = [];
    for (let i = 0; i < moovBox.children.length; i++) {
      const trak = moovBox.children[i];
      if (trak.type !== 'trak') continue;
      const s = findPath(trak.children, ['mdia', 'minf', 'stbl']);
      if (!s) continue;
      const co = findBox(s.children, 'stco');
      if (co) allStco.push(co);
    }

    const signatureUdta = buildSignatureUdta();
    const existingUdta  = findBox(moovBox.children, 'udta');
    if (existingUdta) repl.set(existingUdta, signatureUdta);
    else repl.set('__appendUdta__', signatureUdta);

    function rebuildMoov(box, repl) {
      if (repl.has(box)) return repl.get(box);
      if (!box.children.length) return rawOf(arr, box);
      const prefix = (box.type === 'meta') ? arr.slice(box.cs, box.cs + 4) : new Uint8Array(0);
      const parts  = [prefix];
      for (let i = 0; i < box.children.length; i++) parts.push(rebuildMoov(box.children[i], repl));
      if (box.type === 'moov' && repl.has('__appendUdta__')) {
        parts.push(repl.get('__appendUdta__'));
      }
      const body = join(parts);
      const out  = new Uint8Array(8 + body.length);
      const odv  = new DataView(out.buffer);
      odv.setUint32(0, 8 + body.length, false);
      setFcc(out, 4, box.type);
      out.set(body, 8);
      return out;
    }

    for (let i = 0; i < allStco.length; i++) repl.set(allStco[i], buildStco(readStco(arr, dv, allStco[i]), 0));
    const ftypBytes = ftypBox ? rawOf(arr, ftypBox) : new Uint8Array(0);
    const moov1     = rebuildMoov(moovBox, repl);

    repl.delete('__appendUdta__');

    const newMdatStart = ftypBytes.length + moov1.length + 8;
    const oldMdatStart = mdatBox.cs;
    const delta        = newMdatStart - oldMdatStart;

    for (let i = 0; i < allStco.length; i++) repl.set(allStco[i], buildStco(readStco(arr, dv, allStco[i]), delta));
    const moovFinal = rebuildMoov(moovBox, repl);

    const mdatFull = rawOf(arr, mdatBox);
    const output   = join([ftypBytes, moovFinal, mdatFull]);

    return { output: output.buffer, realSamples: 0, fakeSamples: 0 };
  }

  window.reyyPatchMP4 = reyyPatchMP4;
})();`;

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.statusCode = 200;
  res.end(BROWSER_ENGINE);
};