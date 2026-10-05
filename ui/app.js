/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — ui/app.js
   UI layer: navigation, uploads, toasts, analyzer, account.
   © 2026 ReyyTools · v1.0 · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTION 01 — BOOT STATE
   ═══════════════════════════════════════════════════════════════ */

const BOOT_START = Date.now();
const BOOT_MIN_MS = 1600;

/* ═══════════════════════════════════════════════════════════════
   SECTION 02 — BOOT SPLASH
   ═══════════════════════════════════════════════════════════════ */

function dismissBoot() {
  const el = document.getElementById('boot');
  if (!el) return;

  const elapsed = Date.now() - BOOT_START;
  const wait = Math.max(0, BOOT_MIN_MS - elapsed);

  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 500);
  }, wait);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 03 — TOAST
   ═══════════════════════════════════════════════════════════════ */

let _toastTimer = null;

function notice(msg, ms) {
  const el = document.getElementById('notice');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('is-show');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('is-show'), ms || 2800);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 04 — SCREEN NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

function goScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  const target = document.getElementById('screen_' + name);
  if (target) target.classList.add('is-active');

  document.querySelectorAll('.dock__btn').forEach(b => b.classList.remove('is-active'));
  const btn = document.getElementById('dock_' + name);
  if (btn) btn.classList.add('is-active');

  const nav = document.getElementById('topnav');
  if (nav) nav.classList.remove('is-open');

  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 05 — TOOL TABS
   ═══════════════════════════════════════════════════════════════ */

function switchTool(name) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('is-active'));
  const target = document.getElementById('tool_' + name);
  if (target) target.classList.add('is-active');

  document.querySelectorAll('.wt').forEach(t => t.classList.remove('is-active'));
  document.querySelectorAll('.wt[data-tool="' + name + '"]').forEach(t => t.classList.add('is-active'));
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 06 — PATCH MODE / SCALE
   ═══════════════════════════════════════════════════════════════ */

function pickMode(mode) {
  document.querySelectorAll('.opt').forEach(o => o.classList.remove('is-active'));
  const target = document.querySelector('.opt[data-mode="' + mode + '"]');
  if (target) target.classList.add('is-active');

  const sub = document.getElementById('speed_sub');
  if (sub) {
    if (mode === 'speed') sub.classList.add('is-show');
    else sub.classList.remove('is-show');
  }

  if (typeof setActiveMode === 'function') setActiveMode(mode);
}

function pickScale(el) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
  el.classList.add('is-active');
  if (typeof setActiveScale === 'function') setActiveScale(el.dataset.scale || '2');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 07 — UPSCALE TAB
   ═══════════════════════════════════════════════════════════════ */

function pickUpscale(mode) {
  document.querySelectorAll('.uptab').forEach(t => t.classList.remove('is-active'));
  document.querySelectorAll('.uppanel').forEach(p => p.classList.remove('is-active'));

  const tab   = document.getElementById('uptab_' + mode);
  const panel = document.getElementById('uppanel_' + mode);

  if (tab)   tab.classList.add('is-active');
  if (panel) panel.classList.add('is-active');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 08 — FILE PICKER
   ═══════════════════════════════════════════════════════════════ */

function openPicker(id) {
  const el = document.getElementById(id);
  if (el) el.click();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 09 — VIDEO UPLOAD
   ═══════════════════════════════════════════════════════════════ */

function onPickVideo(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.includes('video') && !file.name.toLowerCase().endsWith('.mp4')) {
    notice('Only MP4 files supported');
    return;
  }

  if (typeof attachVideoFile === 'function') attachVideoFile(file);

  updatePatchFileUI(file);
  updateEncoderFileUI(file);

  const pb = document.getElementById('patch_btn');
  const eb = document.getElementById('enc_btn');
  if (pb) pb.disabled = false;
  if (eb) eb.disabled = false;
}

function updatePatchFileUI(file) {
  const tag = document.getElementById('patch_filetag');
  if (tag) tag.textContent = '📄 ' + file.name;

  const box = document.getElementById('patch_stagebox');
  const vid = document.getElementById('patch_preview');
  const ph  = document.getElementById('patch_stagebox_ph');

  if (box && vid && ph) {
    vid.src = URL.createObjectURL(file);
    vid.muted = true;
    vid.loop = true;
    vid.autoplay = true;
    vid.play().catch(() => {});

    box.classList.add('is-show');
    ph.style.display = 'none';
  }
}

function updateEncoderFileUI(file) {
  const tag = document.getElementById('enc_filetag');
  if (tag) tag.textContent = '📄 ' + file.name;

  const box = document.getElementById('enc_stagebox');
  const vid = document.getElementById('enc_preview');
  const ph  = document.getElementById('enc_stagebox_ph');

  if (box && vid && ph) {
    vid.src = URL.createObjectURL(file);
    vid.muted = true;
    vid.loop = true;
    vid.autoplay = true;
    vid.play().catch(() => {});

    box.classList.add('is-show');
    ph.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 — PHOTO UPLOAD
   ═══════════════════════════════════════════════════════════════ */

function onPickPhoto(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const name = document.getElementById('photo_name');
  if (name) name.textContent = file.name;

  const img = document.getElementById('photo_preview');
  if (img) img.src = URL.createObjectURL(file);

  const btn = document.getElementById('photo_btn');
  if (btn) btn.disabled = false;

  if (typeof attachPhotoFile === 'function') attachPhotoFile(file);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 — VIDEO UPLOAD (CLOUD)
   ═══════════════════════════════════════════════════════════════ */

function onPickVideo2(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const name = document.getElementById('vid2_name');
  if (name) name.textContent = file.name;

  const vid = document.getElementById('vid2_preview');
  if (vid) {
    vid.src = URL.createObjectURL(file);
    vid.muted = true;
    vid.loop = true;
    vid.autoplay = true;
    vid.play().catch(() => {});
  }

  const btn = document.getElementById('vid2_btn');
  if (btn) btn.disabled = false;

  if (typeof attachCloudFile === 'function') attachCloudFile(file);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 12 — STATE / METER / REPORT
   ═══════════════════════════════════════════════════════════════ */

function setState(boxId, textId, text, kind) {
  const box = document.getElementById(boxId);
  const txt = document.getElementById(textId);

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

function setMeter(meterId, fillId, pct, label, eta) {
  const meter = document.getElementById(meterId);
  const fill  = document.getElementById(fillId);
  const labelId = meterId.replace('_meter', '_meter_label');
  const lbl = document.getElementById(labelId);
  const pctEl = document.getElementById(meterId.replace('_meter', '_meter_pct'));
  const etaEl = document.getElementById(meterId.replace('_meter', '_meter_eta'));

  if (meter) {
    if (pct > 0 || label) meter.classList.add('is-show');
    else meter.classList.remove('is-show');
  }
  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (lbl && label) lbl.textContent = label;
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (etaEl) etaEl.textContent = eta || '';
}

function meterLog(meterId, msg, kind) {
  const logEl = document.getElementById(meterId.replace('_meter', '_meter_log'));
  if (!logEl) return;

  const line = document.createElement('div');
  line.textContent = '→ ' + msg;
  if (kind === 'error') line.classList.add('is-error');
  if (kind === 'done')  line.classList.add('is-done');

  logEl.appendChild(line);

  // Keep max 5 lines
  while (logEl.children.length > 5) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function showReport(name, time, before, after) {
  const box = document.getElementById('patch_report');
  if (!box) return;

  const elName = document.getElementById('report_name');
  const elTime = document.getElementById('report_time');
  const elBef  = document.getElementById('report_before');
  const elAft  = document.getElementById('report_after');

  if (elName) elName.textContent = name;
  if (elTime) elTime.textContent = time.toFixed(1) + 's';
  if (elBef)  elBef.textContent  = formatSize(before);
  if (elAft)  elAft.textContent  = formatSize(after);

  box.classList.add('is-show');
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 13 — PROCESS STARTERS
   ═══════════════════════════════════════════════════════════════ */

async function startPatch() {
  if (typeof runPatchPipeline !== 'function') { notice('Engine not ready'); return; }

  const btn = document.getElementById('patch_btn');
  if (btn) btn.disabled = true;

  try {
    await runPatchPipeline();
  } catch (err) {
    console.error('[patch]', err);
    setState('patch_state', 'patch_state_text', 'Error: ' + err.message, 'error');
    meterLog('patch_meter', err.message, 'error');
    notice('Patch failed: ' + err.message);
  }

  if (btn) btn.disabled = false;
}

async function startEncode() {
  if (typeof runEncodePipeline !== 'function') { notice('Encoder not ready'); return; }

  const btn = document.getElementById('enc_btn');
  if (btn) btn.disabled = true;

  try {
    await runEncodePipeline();
  } catch (err) {
    console.error('[encode]', err);
    setState('enc_state', 'enc_state_text', 'Error: ' + err.message, 'error');
    meterLog('enc_meter', err.message, 'error');
    notice('Encode failed: ' + err.message);
  }

  if (btn) btn.disabled = false;
}

async function startPhoto() {
  if (typeof runPhotoUpscale !== 'function') { notice('AI engine not ready'); return; }

  const btn = document.getElementById('photo_btn');
  if (btn) btn.disabled = true;

  try {
    await runPhotoUpscale();
  } catch (err) {
    console.error('[photo]', err);
    meterLog('photo_meter', err.message, 'error');
    notice('Upscale failed: ' + err.message);
  }

  if (btn) btn.disabled = false;
}

async function startCloudVideo() {
  const urlEl = document.getElementById('cloud_url');
  const url = urlEl ? urlEl.value.trim() : '';

  if (!url) { notice('Enter tunnel URL first'); return; }
  if (!/^https?:\/\/.+/i.test(url)) {
    notice('URL must start with http:// or https://');
    return;
  }

  if (typeof runCloudUpscale !== 'function') { notice('Cloud engine not ready'); return; }

  const btn = document.getElementById('vid2_btn');
  if (btn) btn.disabled = true;

  try {
    await runCloudUpscale(url);
  } catch (err) {
    console.error('[cloud]', err);
    meterLog('vid2_meter', err.message, 'error');
    notice('Cloud error: ' + err.message);
  }

  if (btn) btn.disabled = false;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 14 — ANALYZER
   ═══════════════════════════════════════════════════════════════ */

async function startScan() {
  const input = document.getElementById('scan_url');
  const url = input ? input.value.trim() : '';

  if (!url) { notice('Paste a URL first'); return; }
  if (!/tiktok\.com/i.test(url)) { notice('Must be a TikTok link'); return; }

  if (typeof checkAndConsume === 'function') {
    const ok = await checkAndConsume('analyzer');
    if (!ok) return;
  }

  const loading = document.getElementById('scan_loading');
  const errBox  = document.getElementById('scan_error');
  const errMsg  = document.getElementById('scan_error_msg');
  const result  = document.getElementById('scan_result');
  const btn     = document.getElementById('scan_btn');

  if (loading) loading.hidden = false;
  if (errBox)  errBox.hidden  = true;
  if (result)  result.classList.remove('is-show');
  if (btn)     btn.disabled = true;

  try {
    const data = await fetchTikTokMeta(url);
    renderScan(data);
  } catch (err) {
    if (errMsg) errMsg.textContent = err.message;
    if (errBox) errBox.hidden = false;
  } finally {
    if (loading) loading.hidden = true;
    if (btn)     btn.disabled = false;
  }
}

async function fetchTikTokMeta(url) {
  const enc = encodeURIComponent(url);

  const attempts = [
    // 1. allorigins + tikwm
    () => fetchT('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.tikwm.com/api/?url=' + enc + '&hd=1'), 8000)
      .then(r => r.json())
      .then(p => {
        const d = JSON.parse(p.contents);
        if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
        return d.data;
      }),

    // 2. direct tikwm (CORS mode)
    () => fetchT('https://www.tikwm.com/api/?url=' + enc + '&hd=1&web=1', 8000)
      .then(r => r.json())
      .then(d => {
        if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
        return d.data;
      }),

    // 3. allorigins raw
    () => fetchT('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.tikwm.com/api/?url=' + enc + '&hd=1'), 8000)
      .then(r => r.json())
      .then(d => {
        if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
        return d.data;
      }),

    // 4. thingproxy
    () => fetchT('https://thingproxy.freeboard.io/fetch/https://www.tikwm.com/api/?url=' + enc + '&hd=1', 8000)
      .then(r => r.json())
      .then(d => {
        if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
        return d.data;
      })
  ];

  for (const fn of attempts) {
    try { return await fn(); } catch (e) { /* next */ }
  }

  throw new Error('Analyzer sedang down. Coba lagi nanti atau pakai link TikTok panjang (bukan vt.tiktok.com).');
}

function fetchT(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 8000);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

function renderScan(d) {
  const result = document.getElementById('scan_result');
  if (!result) return;

  let isHD = !!(d.hdplay && d.hdplay.length > 10);
  const w = parseInt(d.width, 10) || 0;
  const h = parseInt(d.height, 10) || 0;
  if (w >= 1080 || h >= 1080) isHD = true;

  const badge = document.getElementById('scan_badge');
  if (badge) {
    badge.innerHTML = isHD
      ? '<div class="hd-ok"><div><b>HD Upload Detected</b><i>Video kept in high definition.</i></div></div>'
      : '<div class="hd-no"><div><b>Standard Quality</b><i>Compressed by platform. Try patching before upload.</i></div></div>';
  }

  const head = document.getElementById('scan_head');
  const thumb = document.getElementById('scan_thumb');
  const caption = document.getElementById('scan_caption');
  const author = document.getElementById('scan_author');

  // Skip relative path cover
  const cover = d.cover || d.origin_cover || '';
  if (cover && thumb) {
    if (!cover.startsWith('http')) {
      thumb.style.display = 'none';
    } else {
      thumb.src = 'https://wsrv.nl/?url=' + encodeURIComponent(cover) + '&w=120&h=160&fit=cover';
      thumb.onerror = () => { thumb.style.display = 'none'; };
    }
  }

  if (caption) caption.textContent = d.title || '(no caption)';
  if (author) {
    const a = d.author || {};
    author.textContent = a.nickname
      ? a.nickname + (a.unique_id ? ' (@' + a.unique_id + ')' : '')
      : 'Unknown';
  }
  if (head) head.hidden = false;

  const grid = document.getElementById('scan_grid');
  if (!grid) return;

  function fmtDur(s) {
    s = parseInt(s, 10) || 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + 'm ' + (r < 10 ? '0' : '') + r + 's';
  }
  function fmtSize(b) {
    if (!b || b <= 0) return 'N/A';
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1024).toFixed(0) + ' KB';
  }

  const resStr = (w && h) ? (w + ' × ' + h) : (isHD ? '≥1080p' : '≤720p');

  const items = [
    ['Resolution', resStr],
    ['Duration', d.duration ? fmtDur(d.duration) : 'N/A'],
    ['HD Stream', isHD ? '✓ Available' : '✗ Not Available'],
    ['File Size', fmtSize(d.size)],
    ['HD Size', fmtSize(d.hd_size)],
    ['Likes', d.digg_count ? Number(d.digg_count).toLocaleString() : 'N/A'],
    ['Views', d.play_count ? Number(d.play_count).toLocaleString() : 'N/A'],
    ['Comments', d.comment_count ? Number(d.comment_count).toLocaleString() : 'N/A'],
    ['Shares', d.share_count ? Number(d.share_count).toLocaleString() : 'N/A']
  ];

  grid.innerHTML = items.map(([lbl, val]) =>
    '<div class="card" style="margin:0;padding:14px;">' +
      '<div class="lbl">' + lbl + '</div>' +
      '<div style="font-size:14px;font-weight:700;font-family:var(--f-mono);">' + val + '</div>' +
    '</div>'
  ).join('');

  result.classList.add('is-show');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 15 — ACCOUNT
   ═══════════════════════════════════════════════════════════════ */

let _profile = { name: 'Guest', tgId: '', tgUser: '', avatar: '' };

function loadProfile() {
  try {
    const raw = localStorage.getItem('rey_profile');
    if (raw) _profile = Object.assign(_profile, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  renderProfile();
}

function renderProfile() {
  const nameEl = document.getElementById('who_name');
  const roleEl = document.getElementById('who_role');
  const initEl = document.getElementById('av_initial');
  const imgEl  = document.getElementById('av_img');
  const tgBox  = document.getElementById('tg_state');
  const tgTxt  = document.getElementById('tg_text');
  const nameInput = document.getElementById('prof_name');
  const idInput   = document.getElementById('tg_id');
  const userInput = document.getElementById('tg_user');

  const name = _profile.name || 'Guest';
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = _profile.tgId ? 'Telegram Linked' : 'Guest User';
  if (initEl) initEl.textContent = name.charAt(0).toUpperCase();
  if (nameInput) nameInput.value = (name !== 'Guest') ? name : '';
  if (idInput)   idInput.value   = _profile.tgId || '';
  if (userInput) userInput.value = _profile.tgUser || '';

  if (tgBox && tgTxt) {
    if (_profile.tgId) {
      tgBox.classList.add('is-linked');
      tgTxt.textContent = 'Connected: ' + (_profile.tgUser ? _profile.tgUser + ' (' + _profile.tgId + ')' : _profile.tgId);
    } else {
      tgBox.classList.remove('is-linked');
      tgTxt.textContent = 'Not connected';
    }
  }

  if (imgEl && _profile.avatar) {
    imgEl.src = _profile.avatar;
    if (initEl) initEl.style.display = 'none';
  }
}

function saveProf() {
  const el = document.getElementById('prof_name');
  const name = (el ? el.value : '').trim() || 'Guest';
  _profile.name = name;
  localStorage.setItem('rey_profile', JSON.stringify(_profile));
  renderProfile();
  notice('Profile saved');
}

function linkTg() {
  const idEl   = document.getElementById('tg_id');
  const userEl = document.getElementById('tg_user');
  const id   = (idEl ? idEl.value : '').trim();
  const user = (userEl ? userEl.value : '').trim();

  if (!id) { notice('Enter Telegram ID first'); return; }

  _profile.tgId   = id;
  _profile.tgUser = user;
  localStorage.setItem('rey_profile', JSON.stringify(_profile));
  renderProfile();
  notice('Telegram linked');
}

function unlinkTg() {
  _profile.tgId   = '';
  _profile.tgUser = '';
  localStorage.setItem('rey_profile', JSON.stringify(_profile));
  renderProfile();
  notice('Telegram unlinked');
}

function onPickAvatar(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    _profile.avatar = ev.target.result;
    localStorage.setItem('rey_profile', JSON.stringify(_profile));
    renderProfile();
    notice('Avatar updated');
  };
  reader.readAsDataURL(file);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 16 — QUOTA MODAL
   ═══════════════════════════════════════════════════════════════ */

function showQuota(msg) {
  const modal = document.getElementById('quota_modal');
  const txt   = document.getElementById('quota_msg');
  if (txt)   txt.innerHTML = msg || 'Daily quota reached. Try again tomorrow or upgrade.';
  if (modal) modal.classList.add('is-show');
}

function closeQuota() {
  const modal = document.getElementById('quota_modal');
  if (modal) modal.classList.remove('is-show');
}

function upgradeNow() {
  window.open('https://t.me/reyystecuu_bot', '_blank');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 17 — DUST CANVAS
   ═══════════════════════════════════════════════════════════════ */

(function initDust() {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('dust');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H;
    const dots = [];

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function Dot() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = 0.4 + Math.random() * 1.2;
      this.vx = (Math.random() - 0.5) * 0.15;
      this.vy = (Math.random() - 0.5) * 0.15;
      this.a  = 0.08 + Math.random() * 0.22;
    }
    Dot.prototype.tick = function () {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
      }
    };
    Dot.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45,212,191,' + this.a + ')';
      ctx.fill();
    };

    for (let i = 0; i < 50; i++) dots.push(new Dot());

    (function loop() {
      ctx.clearRect(0, 0, W, H);
      dots.forEach(d => { d.tick(); d.draw(); });
      requestAnimationFrame(loop);
    })();
  });
})();

/* ═══════════════════════════════════════════════════════════════
   SECTION 18 — TOP NAV TOGGLE
   ═══════════════════════════════════════════════════════════════ */

(function initMenu() {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('menu_btn');
    const nav = document.getElementById('topnav');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => nav.classList.toggle('is-open'));
  });
})();

/* ═══════════════════════════════════════════════════════════════
   SECTION 19 — KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const scanInput = document.getElementById('scan_url');
  if (scanInput) {
    scanInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') startScan();
    });
  }

  const gateInput = document.getElementById('gate_input');
  if (gateInput) {
    gateInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && typeof doLogin === 'function') doLogin();
    });
  }

  const gateBtn = document.getElementById('gate_btn');
  if (gateBtn && typeof doLogin === 'function') {
    gateBtn.addEventListener('click', doLogin);
  }
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 20 — INIT
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  dismissBoot();

  if (typeof initSession === 'function') initSession();

  setTimeout(() => {
    if (typeof loadEngineLibs === 'function') loadEngineLibs();
  }, 3000);
});

console.log('[ReyyTools] UI v1.0 loaded · © ReyStecu');