/* ═══════════════════════════════════════════════════════════════
   REYYTOOLS — core/session.js
   Authentication + quota + session state.
   © 2026 ReyyTools · v1.0 · Crafted by ReyStecu
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTION 01 — CONFIG
   ═══════════════════════════════════════════════════════════════ */

const BOT_API  = 'https://reyystecu-bot.furqonalmughni95.workers.dev';
const BOT_LINK = 'https://t.me/reyystecuu_bot';

/* ═══════════════════════════════════════════════════════════════
   SECTION 02 — QUOTA TABLE
   ═══════════════════════════════════════════════════════════════ */

const QUOTA_TABLE = {
  free:  { patch: 2,      encode: 0,      photo: 0,      cloud: 0,      analyzer: 5 },
  basic: { patch: 20,     encode: 20,     photo: 20,     cloud: 20,     analyzer: 20 },
  pro:   { patch: 999999, encode: 999999, photo: 999999, cloud: 999999, analyzer: 999999 }
};

const FEATURE_LABEL = {
  patch:    'Metadata Patch',
  encode:   'Advanced Encoder',
  photo:    'Photo Upscale',
  cloud:    'Cloud Video Upscale',
  analyzer: 'Upload Analyzer'
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 03 — MODULE STATE (var → global)
   ═══════════════════════════════════════════════════════════════ */

var currentUser = null;
var currentTier = 'free';

/* ═══════════════════════════════════════════════════════════════
   SECTION 04 — INIT
   ═══════════════════════════════════════════════════════════════ */

function initSession() {
  const raw = localStorage.getItem('rey_user');

  if (raw) {
    try {
      currentUser = JSON.parse(raw);
      currentTier = currentUser.tier || 'free';
      verifySession(currentUser.username || currentUser.tg);
    } catch (e) {
      openGate();
    }
  } else {
    openGate();
  }

  refreshBadges();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 05 — VERIFY SESSION
   ═══════════════════════════════════════════════════════════════ */

async function verifySession(identifier) {
  if (!identifier) { openGate(); return; }

  try {
    const isTgId = /^\d+$/.test(identifier);
    const param  = isTgId ? ('tg=' + identifier) : ('username=' + identifier);

    const res  = await fetch(BOT_API + '/api/auth?' + param);
    const data = await res.json();

    if (data.ok) {
      currentUser = {
        username:   data.username || identifier,
        tg:         data.tg,
        tier:       data.tier,
        remaining:  data.remaining,
        expiry:     data.expiry,
        registered: data.registered
      };
      currentTier = data.tier;

      localStorage.setItem('rey_user', JSON.stringify(currentUser));
      closeGate();
      refreshBadges();
    } else {
      if (data.reason === 'username_not_found' || !data.registered) {
        openGate('Username not registered. Register via bot.');
      } else {
        closeGate();
        refreshBadges();
      }
    }
  } catch (e) {
    if (currentUser) {
      closeGate();
      refreshBadges();
    } else {
      openGate('Cannot reach server. Try again.');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 06 — LOGIN
   ═══════════════════════════════════════════════════════════════ */

async function doLogin() {
  const input = document.getElementById('gate_input');
  const errEl = document.getElementById('gate_err');
  const btn   = document.getElementById('gate_btn');

  const val = ((input && input.value) || '').trim().toLowerCase().replace(/^@/, '');

  if (!val || val.length < 3) {
    showGateErr('Enter a valid username or Telegram ID');
    return;
  }

  if (errEl) errEl.classList.remove('is-show');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }

  try {
    const isTgId = /^\d+$/.test(val);
    const param  = isTgId ? ('tg=' + val) : ('username=' + val);

    const res  = await fetch(BOT_API + '/api/auth?' + param);
    const data = await res.json();

    if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }

    if (!data.ok) {
      showGateErr('Something went wrong. Try again.');
      return;
    }
    if (!data.registered) {
      showGateErr('Not registered. Join @reyystecuu_bot first.');
      return;
    }

    currentUser = {
      username:   data.username || val,
      tg:         data.tg,
      tier:       data.tier,
      remaining:  data.remaining,
      expiry:     data.expiry,
      registered: true
    };
    currentTier = data.tier;

    localStorage.setItem('rey_user', JSON.stringify(currentUser));
    closeGate();
    refreshBadges();

    if (typeof notice === 'function') notice('Welcome back');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Continue'; }
    showGateErr('Connection failed. Try again.');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 07 — GATE SCREEN
   ═══════════════════════════════════════════════════════════════ */

function openGate(msg) {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = false;
  if (msg) showGateErr(msg);
}

function closeGate() {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = true;
}

function showGateErr(msg) {
  const el = document.getElementById('gate_err');
  if (el) {
    el.textContent = msg;
    el.classList.add('is-show');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 08 — BADGES
   ═══════════════════════════════════════════════════════════════ */

function refreshBadges() {
  const tierEl  = document.getElementById('badge_tier');
  const usageEl = document.getElementById('badge_usage');

  if (tierEl) {
    if (currentTier === 'pro') {
      tierEl.textContent = '👑 VIP+';
      tierEl.className   = 'tier tier--pro';
    } else if (currentTier === 'basic') {
      tierEl.textContent = '⭐ Premium';
      tierEl.className   = 'tier tier--basic';
    } else {
      tierEl.textContent = 'Free';
      tierEl.className   = 'tier tier--free';
    }
  }

  if (usageEl) {
    const remaining = remainingQuota('patch');
    usageEl.textContent = 'Patch: ' + remaining;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 09 — QUOTA
   ═══════════════════════════════════════════════════════════════ */

function quotaLimit(feature) {
  const tierTable = QUOTA_TABLE[currentTier] || QUOTA_TABLE.free;
  return tierTable[feature] != null ? tierTable[feature] : 0;
}

function remainingQuota(feature) {
  const limit = quotaLimit(feature);
  if (limit >= 999999) return '∞';
  if (limit === 0)     return '—';

  const today = new Date().toDateString();
  const raw   = JSON.parse(localStorage.getItem('rey_usage') || '{}');
  const rec   = raw[feature];

  if (!rec || rec.date !== today) return limit;

  return Math.max(0, limit - rec.count);
}

async function checkAndConsume(feature) {
  const limit = quotaLimit(feature);

  if (limit >= 999999) return true;

  if (limit === 0) {
    if (typeof showQuota === 'function') {
      showQuota('<b>' + (FEATURE_LABEL[feature] || feature) + '</b> is available for <b>Premium</b> and <b>VIP+</b> users. Upgrade to unlock.');
    }
    return false;
  }

  const today = new Date().toDateString();
  const raw   = JSON.parse(localStorage.getItem('rey_usage') || '{}');
  const rec   = raw[feature] || { count: 0, date: today };

  if (rec.date !== today) {
    rec.count = 0;
    rec.date  = today;
  }

  if (rec.count >= limit) {
    if (typeof showQuota === 'function') {
      showQuota('You have used <b>' + rec.count + '/' + limit + '</b> of <b>' + (FEATURE_LABEL[feature] || feature) + '</b> today. Upgrade for more.');
    }
    return false;
  }

  rec.count += 1;
  raw[feature] = rec;
  localStorage.setItem('rey_usage', JSON.stringify(raw));
  refreshBadges();

  return true;
}

function recordUsage(feature) {
  try {
    const stats = JSON.parse(localStorage.getItem('rey_stats') || '{}');
    stats[feature] = (stats[feature] || 0) + 1;
    stats.last_activity = Date.now();
    localStorage.setItem('rey_stats', JSON.stringify(stats));
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 — DAILY RESET
   ═══════════════════════════════════════════════════════════════ */

(function autoReset() {
  const today = new Date().toDateString();
  const last  = localStorage.getItem('rey_last_reset');

  if (last !== today) {
    localStorage.removeItem('rey_usage');
    localStorage.setItem('rey_last_reset', today);
  }
})();

console.log('[ReyyTools] session.js v1.0 loaded · © ReyStecu');