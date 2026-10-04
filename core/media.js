/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — core/media.js
   FFmpeg.wasm loader + ONNX upscale + Cloud GPU upscale.
   © 2026 ReyyTools · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   MODULE STATE
   ═══════════════════════════════════════════════════════════════ */

let _ffmpegLoaded = false;
let _ffmpegInst   = null;

let _activePhotoFile = null;
let _activeCloudFile = null;

const MODEL_URL = '/noise2_scale2.0x_model.onnx';

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — FILE HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function attachPhotoFile(file) { _activePhotoFile = file; }
function attachCloudFile(file) { _activeCloudFile = file; }

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — LIBRARY LOADER (FFmpeg + ONNX + TF.js)
   ═══════════════════════════════════════════════════════════════ */

const REY_LIBS = [
  { name: 'FFmpeg',   src: 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',     global: 'FFmpeg' },
  { name: 'ONNX',     src: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js',    global: 'ort' },
  { name: 'TF.js',    src: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js', global: 'tf' }
];

const _reyLibsState = { loaded: false, loading: null };

function loadEngineLibs() {
  if (_reyLibsState.loaded) return Promise.resolve();
  if (_reyLibsState.loading) return _reyLibsState.loading;

  _reyLibsState.loading = new Promise((resolve) => {
    let done = 0;
    REY_LIBS.forEach(lib => {
      if (window[lib.global]) {
        done++;
        if (done === REY_LIBS.length) {
          _reyLibsState.loaded = true;
          _reyLibsState.loading = null;
          resolve();
        }
        return;
      }

      const s = document.createElement('script');
      s.src = lib.src;
      s.async = true;

      const finish = () => {
        done++;
        if (done === REY_LIBS.length) {
          _reyLibsState.loaded = true;
          _reyLibsState.loading = null;
          console.log('[ReyyTools] Engine libs loaded');
          resolve();
        }
      };

      s.onload  = finish;
      s.onerror = () => { console.warn('[ReyyTools] Failed to load ' + lib.name); finish(); };

      document.head.appendChild(s);
    });
  });

  return _reyLibsState.loading;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — WAIT FOR GLOBAL
   ═══════════════════════════════════════════════════════════════ */

async function waitForGlobal(name, timeoutMs) {
  const start = Date.now();
  const max = timeoutMs || 15000;

  while (typeof window[name] === 'undefined') {
    if (Date.now() - start > max) return false;
    await new Promise(r => setTimeout(r, 150));
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — FFMPEG LOADER
   ═══════════════════════════════════════════════════════════════ */

function threadCount() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, cores - 1));
}

async function loadFFmpeg() {
  if (_ffmpegLoaded) return _ffmpegInst;

  // Trigger load libs
  loadEngineLibs();

  // Wait for FFmpeg global
  const ready = await waitForGlobal('FFmpeg', 15000);
  if (!ready) {
    throw new Error('FFmpeg failed to load. Check your internet connection.');
  }

  setState('enc_state', 'enc_state_text', 'Loading FFmpeg.wasm…', 'working');
  setMeter('enc_meter', 'enc_meter_fill', 5, 'Booting engine');

  const { createFFmpeg, fetchFile } = FFmpeg;

  const ff = createFFmpeg({
    log:      false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
  });

  await ff.load();

  ff._fetchFile   = fetchFile;
  ff._multiThread = window.crossOriginIsolated === true;

  _ffmpegLoaded = true;
  _ffmpegInst   = ff;
  return ff;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — PHOTO UPSCALE (ONNX)
   ═══════════════════════════════════════════════════════════════ */

async function runPhotoUpscale() {
  if (!_activePhotoFile) throw new Error('No photo loaded');

  // Trigger load libs
  loadEngineLibs();

  // Wait for ONNX
  const ready = await waitForGlobal('ort', 15000);
  if (!ready) {
    throw new Error('AI engine failed to load. Check your internet connection.');
  }

  const t0 = Date.now();

  if (typeof checkAndConsume === 'function') {
    const ok = await checkAndConsume('photo');
    if (!ok) return;
  }

  setMeter('photo_meter', 'photo_meter_fill', 10, 'Loading model');
  const meterLbl = document.getElementById('photo_meter_label');
  if (meterLbl) meterLbl.textContent = 'Loading model…';

  if (ort.env && ort.env.wasm) {
    ort.env.wasm.numThreads = 4;
    ort.env.wasm.wasmPaths  = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  }

  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm']
  });

  setMeter('photo_meter', 'photo_meter_fill', 25, 'Preparing image');

  const img = new Image();
  img.src = URL.createObjectURL(_activePhotoFile);
  await new Promise(r => { img.onload = r; });

  let targetW = Math.floor(img.width  / 4) * 4;
  let targetH = Math.floor(img.height / 4) * 4;

  if (targetW > 1080 || targetH > 1080) {
    const ratio = Math.min(1080 / targetW, 1080 / targetH);
    targetW = Math.floor((targetW * ratio) / 4) * 4;
    targetH = Math.floor((targetH * ratio) / 4) * 4;
  }

  const canvas = document.createElement('canvas');
  canvas.width  = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

  const floatData = new Float32Array(3 * targetH * targetW);
  const area = targetH * targetW;

  for (let i = 0; i < area; i++) {
    floatData[i]            = imgData[i * 4]     / 255.0;
    floatData[area + i]     = imgData[i * 4 + 1] / 255.0;
    floatData[2 * area + i] = imgData[i * 4 + 2] / 255.0;
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, targetH, targetW]);
  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  setMeter('photo_meter', 'photo_meter_fill', 55, 'Rendering');
  await new Promise(r => setTimeout(r, 40));

  const results      = await session.run(feeds);
  const outputTensor = results[session.outputNames[0]];
  const outData      = outputTensor.data;
  const dims         = outputTensor.dims;

  let outH, outW, isNCHW;
  if (dims[1] === 3) {
    isNCHW = true; outH = dims[2]; outW = dims[3];
  } else {
    isNCHW = false; outH = dims[1]; outW = dims[2];
  }
  const pixels = outH * outW;

  setMeter('photo_meter', 'photo_meter_fill', 80, 'Reconstructing');

  const outCanvas = document.createElement('canvas');
  outCanvas.width  = outW;
  outCanvas.height = outH;
  const outCtx     = outCanvas.getContext('2d');
  const outImgData = outCtx.createImageData(outW, outH);

  for (let i = 0; i < pixels; i++) {
    let r, g, b;
    if (isNCHW) {
      r = outData[i]              * 255;
      g = outData[i + pixels]     * 255;
      b = outData[i + 2 * pixels] * 255;
    } else {
      r = outData[i * 3]     * 255;
      g = outData[i * 3 + 1] * 255;
      b = outData[i * 3 + 2] * 255;
    }
    outImgData.data[i * 4]     = Math.round(Math.max(0, Math.min(255, r)));
    outImgData.data[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)));
    outImgData.data[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)));
    outImgData.data[i * 4 + 3] = 255;
  }

  outCtx.putImageData(outImgData, 0, 0);

  setMeter('photo_meter', 'photo_meter_fill', 100, 'Complete');

  await new Promise(resolve => {
    outCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'reyytools_upscale_' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    });
  });

  if (meterLbl) meterLbl.textContent = 'Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's';
  if (typeof recordUsage === 'function') recordUsage('photo');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — CLOUD VIDEO UPSCALE
   ═══════════════════════════════════════════════════════════════ */

async function runCloudUpscale(apiUrl) {
  if (!_activeCloudFile) throw new Error('No video loaded');
  if (!apiUrl) throw new Error('Tunnel URL required');

  if (typeof checkAndConsume === 'function') {
    const ok = await checkAndConsume('cloud');
    if (!ok) return;
  }

  const t0 = Date.now();
  const lbl = document.getElementById('vid2_meter_label');

  setMeter('vid2_meter', 'vid2_meter_fill', 20, 'Uploading');
  if (lbl) lbl.textContent = 'Uploading to cloud…';

  const form = new FormData();
  form.append('file', _activeCloudFile);

  const cleanUrl = apiUrl.replace(/\/+$/, '');

  const res = await fetch(cleanUrl + '/upscale', {
    method:  'POST',
    body:    form,
    headers: { 'ngrok-skip-browser-warning': 'true' }
  });

  if (!res.ok) throw new Error('Cloud responded with HTTP ' + res.status);

  setMeter('vid2_meter', 'vid2_meter_fill', 70, 'Processing');
  if (lbl) lbl.textContent = 'GPU processing…';

  const blob = await res.blob();
  const ab   = await blob.arrayBuffer();

  setMeter('vid2_meter', 'vid2_meter_fill', 100, 'Complete');
  if (lbl) lbl.textContent = 'Done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's';

  const baseName = _activeCloudFile.name.replace(/\.[^/.]+$/, '');
  const url = URL.createObjectURL(new Blob([ab], { type: 'video/mp4' }));
  const a   = document.createElement('a');
  a.href = url;
  a.download = baseName + '_cloud_upscale_reyytools.mp4';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof recordUsage === 'function') recordUsage('cloud');
}

console.log('[ReyyTools] media.js loaded · © ReyStecu');