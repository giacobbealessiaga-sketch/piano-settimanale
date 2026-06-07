const DAYS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MFULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// ── SESSION ──────────────────────────────────────────────────────
let session = JSON.parse(localStorage.getItem('sb_session') || 'null');
let db = JSON.parse(localStorage.getItem('ps_cache') || '{}'); // local cache
function saveCache() { localStorage.setItem('ps_cache', JSON.stringify(db)); }
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

// ── SYNC STATE ───────────────────────────────────────────────────
function setSyncState(state) {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  dot.className = 'sync-dot ' + state;
}

// ── AUTH ─────────────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  if (!email || !password) { errEl.textContent = 'Inserisci email e password.'; return; }
  btn.disabled = true; btn.textContent = 'Accesso...'; errEl.textContent = '';
  const res = await sb.signIn(email, password);
  btn.disabled = false; btn.textContent = 'Accedi';
  if (res.error) { errEl.textContent = res.error.message || 'Errore di accesso.'; return; }
  session = { token: res.access_token, refreshToken: res.refresh_token, userId: res.user.id, email: res.user.email, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  localStorage.setItem('sb_session', JSON.stringify(session));
  await startApp();
});

document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  const msgEl = document.getElementById('signup-msg');
  const btn = document.getElementById('btn-signup');
  if (!email || !password) { errEl.textContent = 'Inserisci email e password.'; return; }
  if (password.length < 6) { errEl.textContent = 'Password minimo 6 caratteri.'; return; }
  btn.disabled = true; btn.textContent = 'Registrazione...'; errEl.textContent = ''; msgEl.textContent = '';
  const res = await sb.signUp(email, password);
  btn.disabled = false; btn.textContent = 'Crea account';
  if (res.error) { errEl.textContent = res.error.message || 'Errore di registrazione.'; return; }
  msgEl.textContent = 'Account creato! Controlla la tua email per confermare, poi accedi.';
});

// ── START APP ────────────────────────────────────────────────────

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────
// Refresh token every 45 minutes to avoid session expiry
function startTokenRefresh() {
  setInterval(async () => {
    if (!session) return;
    try {
      const r = await fetch('https://grmfbbqujopstaagknuc.supabase.co/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'sb_publishable_S5LYjuFe5m4ieS6BNZXz5A_-E7kuxuK' },
        body: JSON.stringify({ refresh_token: session.refreshToken })
      });
      const data = await r.json();
      if (data.access_token) {
        session.token = data.access_token;
        if (data.refresh_token) session.refreshToken = data.refresh_token;
        localStorage.setItem('sb_session', JSON.stringify(session));
      }
    } catch(e) { console.log('Token refresh failed', e); }
  }, 45 * 60 * 1000); // every 45 minutes
}

async function startApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  startTokenRefresh();
  // Show app immediately with cached data
  wireDayViewEvents();
  renderWeek();
  document.getElementById('hdr-email').textContent = session.email.split('@')[0];
  document.getElementById('menu-email').textContent = session.email;

  // Load all data from cloud into local cache
  setSyncState('syncing');
  try {
    const rows = await sb.getAllDays(session.token, session.userId);
    if (Array.isArray(rows)) {
      const synced = JSON.parse(localStorage.getItem('ps_synced') || '{}');
      const localDb = { ...db };
      db = {};
      rows.forEach(r => { db[r.day_key] = r.content; });
      // For each key in local cache: if local was modified AFTER last sync, keep local
      for (const key of Object.keys(localDb)) {
        const syncInfo = synced[key];
        const localContent = localDb[key] || '';
        const cloudContent = db[key] || '';
        // If local content differs from what was last synced → local has unsaved changes
        if (syncInfo && localContent !== cloudContent) {
          const lastSyncedLen = syncInfo.len || 0;
          // Local changed since last sync (different length from synced version)
          if (localContent.length !== lastSyncedLen) {
            db[key] = localContent; // keep local
            syncDay(key); // re-push to cloud
          }
        } else if (!db[key] && localContent) {
          db[key] = localContent;
          syncDay(key);
        }
      }
      saveCache();
    }
    const notes = await sb.getNotes(session.token, session.userId);
    localStorage.setItem('ps_notes', notes);
    setSyncState('ok');
  } catch(e) {
    setSyncState('error');
  }
  renderWeek();
}

// Auto-login if session exists
(async () => {
  if (session && session.token && session.userId) {
    // Try to refresh token first, then start app
    try {
      if (session.refreshToken) {
        const r = await fetch('https://grmfbbqujopstaagknuc.supabase.co/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': 'sb_publishable_S5LYjuFe5m4ieS6BNZXz5A_-E7kuxuK' },
          body: JSON.stringify({ refresh_token: session.refreshToken })
        });
        const data = await r.json();
        if (data.access_token) {
          session.token = data.access_token;
          if (data.refresh_token) session.refreshToken = data.refresh_token;
          localStorage.setItem('sb_session', JSON.stringify(session));
        }
      }
      await startApp();
      return;
    } catch(e) {
      console.log('Auto-login failed:', e);
    }
    // Only clear session if refresh explicitly failed
  }
  document.getElementById('auth-screen').style.display = 'flex';
})();

// ── WEEK RENDERING ───────────────────────────────────────────────
let weekOffset = 0, calY, calM;

// ── DAY VIEW ──────────────────────────────────────────────────────
const DAYS_FULL = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const MONTHS_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
let dvDate = null;

function openDay(d) {
  d = new Date(d); d.setHours(0,0,0,0); dvDate = d;
  renderDayView();
  document.getElementById('day-view').classList.add('open');
  setTimeout(() => { const ed = document.getElementById('dv-editor'); ed.focus(); placeCaretAtEnd(ed); }, 120);
}
function renderDayView() {
  const key = dayKey(dvDate);
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById('dv-dow').textContent = DAYS_FULL[dvDate.getDay()];
  document.getElementById('dv-date').textContent = dvDate.getDate() + ' ' + MONTHS_FULL[dvDate.getMonth()] + ' ' + dvDate.getFullYear();
  document.getElementById('dv-dow').style.color = dvDate.getTime() === today.getTime() ? '#c0392b' : '';
  document.getElementById('dv-editor').innerHTML = db[key] || '';
}
let dvSaveTimer = null;
// dv-editor events wired after DOM ready (see bottom)
function closeDay() {
  document.getElementById('day-view').classList.remove('open');
  hideToolbar('dv'); dvDate = null; activeEditor = null;
}
function wireDayViewEvents() {
  const dvEd = document.getElementById('dv-editor');
  dvEd.addEventListener('input', function() {
    const key = dayKey(dvDate);
    const html = this.innerHTML;
    if (html && html !== '<br>' && html !== '') db[key] = html; else delete db[key];
    saveCache();
    clearTimeout(dvSaveTimer);
    dvSaveTimer = setTimeout(() => {
      syncDay(key);
      const card = document.querySelector('.day-editor[data-key="' + key + '"]');
      if (card && document.activeElement !== card) card.innerHTML = db[key] || '';
    }, 600);
  });
  dvEd.addEventListener('focus', function() { activeEditor = this; showToolbar('dv'); updateDvToolbarState(); });
  dvEd.addEventListener('blur', function() {
    setTimeout(() => {
      const tbDv = document.getElementById('toolbar-dv');
      if (tbDv && !tbDv.contains(document.activeElement) && document.activeElement !== this) {
        if (activeEditor === this) { activeEditor = null; hideToolbar('dv'); }
      }
    }, 150);
  });
  dvEd.addEventListener('keyup', updateDvToolbarState);
  dvEd.addEventListener('mouseup', updateDvToolbarState);

  document.getElementById('dv-back').addEventListener('click', closeDay);
  document.getElementById('dv-prev').addEventListener('click', () => {
    const d = new Date(dvDate); d.setDate(d.getDate() - 1); dvDate = d;
    renderDayView(); setTimeout(() => document.getElementById('dv-editor').focus(), 50);
  });
  document.getElementById('dv-next').addEventListener('click', () => {
    const d = new Date(dvDate); d.setDate(d.getDate() + 1); dvDate = d;
    renderDayView(); setTimeout(() => document.getElementById('dv-editor').focus(), 50);
  });
  document.getElementById('dv-nav-oggi').addEventListener('click', () => openDay(new Date()));
  document.getElementById('dv-nav-appunti').addEventListener('click', () => {
    closeDay();
    document.getElementById('notes-area').value = localStorage.getItem('ps_notes') || '';
    document.getElementById('appunti-overlay').classList.add('show');
  });
  const dvMenu = document.getElementById('dv-nav-menu');
  if (dvMenu) dvMenu.addEventListener('click', () => {
    closeDay();
    const mo = document.getElementById('menu-overlay');
    if (mo) mo.classList.add('show');
    setNav('menu');
  });

  // DV toolbar buttons
  function tbDvBind(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
    el.addEventListener('touchend', e => { e.preventDefault(); fn(); });
  }
  tbDvBind('dv-bold', () => fmt('bold'));
  tbDvBind('dv-italic', () => fmt('italic'));
  tbDvBind('dv-under', () => fmt('underline'));
  tbDvBind('dv-strike', () => fmt('strikeThrough'));
  tbDvBind('dv-ul', toggleBullet);

  document.getElementById('dv-cur-color').addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    document.getElementById('dv-color-menu').classList.toggle('show');
  });
  document.querySelectorAll('#dv-color-menu .cm-dot').forEach(dot => {
    const apply = function(e) {
      e.preventDefault(); e.stopPropagation();
      currentColor = this.dataset.color;
      document.getElementById('dv-cur-color').style.background = currentColor;
      document.querySelectorAll('#dv-color-menu .cm-dot').forEach(d => d.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('dv-color-menu').classList.remove('show');
      fmt('foreColor', currentColor);
    };
    dot.addEventListener('mousedown', apply); dot.addEventListener('touchend', apply);
  });
}
function updateDvToolbarState() {
  if (!activeEditor) return; saveRange();
  const map = {bold:'dv-bold',italic:'dv-italic',underline:'dv-under',strikeThrough:'dv-strike',insertUnorderedList:'dv-ul'};
  Object.entries(map).forEach(([cmd, id]) => {
    const el = document.getElementById(id); if (el) el.classList.toggle('on', document.queryCommandState(cmd));
  });
}

let activeEditor = null, savedRange = null, currentColor = '#1a1a1a';
let isEditing = false;

function getMonday(offset) {
  const t = new Date(); t.setHours(0,0,0,0);
  const dow = t.getDay(), diff = dow === 0 ? -6 : 1 - dow;
  const m = new Date(t); m.setDate(t.getDate() + diff + offset * 7);
  return m;
}
function getWeekNum(d) {
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - jan) / 86400000) + jan.getDay() + 1) / 7);
}
function buildSpiral() {
  const col = document.getElementById('spiral-col'); col.innerHTML = '';
  const h = document.getElementById('main-page').offsetHeight || 500;
  for (let i = 0; i < Math.floor(h / 13); i++) {
    const r = document.createElement('div'); r.className = 'ring'; col.appendChild(r);
  }
}

function renderWeek() {
  const mon = getMonday(weekOffset);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate() + i); days.push(d); }
  const hdrMonth = document.getElementById('hdr-month');
  if (hdrMonth) hdrMonth.textContent = MONTHS[mon.getMonth()] + ' ' + mon.getFullYear();
  const weekRangeEl = document.getElementById('week-range');
  if (weekRangeEl) weekRangeEl.textContent =
    days[0].getDate() + ' ' + MONTHS[days[0].getMonth()] + ' – ' +
    days[6].getDate() + ' ' + MONTHS[days[6].getMonth()] + ' ' + days[6].getFullYear();
  const left = document.getElementById('left-col'), right = document.getElementById('right-col');
  left.innerHTML = ''; right.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);
  [days[0], days[1], days[2]].forEach(d => left.appendChild(makeCard(d, today)));
  [days[3], days[4]].forEach(d => right.appendChild(makeCard(d, today)));
  const wkWrap = document.createElement('div'); wkWrap.className = 'weekend-wrap';
  [days[5], days[6]].forEach(d => wkWrap.appendChild(makeCard(d, today)));
  right.appendChild(wkWrap);
  setTimeout(buildSpiral, 80);
}

function makeCard(d, today) {
  const key = dayKey(d), isToday = d.getTime() === today.getTime();
  const card = document.createElement('div'); card.className = 'day-card'; card.dataset.key = key;
  const hdr = document.createElement('div');
  hdr.className = 'day-hdr' + (isToday ? ' today' : '');
  hdr.innerHTML = '<span class="dow">' + DAYS[d.getDay()] + '</span><span class="num">' + d.getDate() + '</span><span class="mon-lbl">' + MONTHS[d.getMonth()] + '</span>';
  const body = document.createElement('div'); body.className = 'day-body';
  const lines = document.createElement('div'); lines.className = 'day-lines';
  const editor = document.createElement('div');
  editor.className = 'day-editor'; editor.contentEditable = 'true';
  editor.setAttribute('spellcheck', 'true'); editor.dataset.key = key;
  if (db[key]) editor.innerHTML = db[key];

  // Debounced save to cloud
  let saveTimer = null;
  editor.addEventListener('input', function() {
    const html = this.innerHTML;
    if (html && html !== '<br>' && html !== '') db[key] = html; else delete db[key];
    saveCache(); // always save to localStorage immediately
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => syncDay(key), 800); // sync to cloud after 800ms pause
  });

  editor.addEventListener('focus', function() {
    activeEditor = this; isEditing = true;
    // Lock notebook scroll position before card expands
    const nb = document.getElementById('notebook');
    const savedScroll = nb ? nb.scrollTop : 0;
    card.classList.add('active');
    showToolbar('main'); updateToolbarState();
    // Restore scroll immediately and on next frame
    if (nb) {
      nb.scrollTop = savedScroll;
      requestAnimationFrame(() => {
        nb.scrollTop = savedScroll;
        setTimeout(() => { nb.scrollTop = savedScroll; }, 50);
      });
    }
  });
  editor.addEventListener('blur', function() {
    // Save immediately on blur — don't wait for debounce timer
    clearTimeout(saveTimer);
    const html = this.innerHTML;
    if (html && html !== '<br>' && html !== '') db[key] = html; else delete db[key];
    saveCache();
    syncDay(key); // immediate sync on blur
    setTimeout(() => {
      if (!toolbar.contains(document.activeElement) && document.activeElement !== this) {
        card.classList.remove('active');
        if (activeEditor === this) { activeEditor = null; isEditing = false; hideToolbar('main'); }
      }
    }, 150);
  });
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  body.addEventListener('touchmove', e => { if (isEditing) e.stopPropagation(); }, { passive: true });
  body.addEventListener('click', e => { if (e.target === body || e.target === lines) { editor.focus(); placeCaretAtEnd(editor); } });
  hdr.addEventListener('click', () => openDay(d));
  body.appendChild(lines); body.appendChild(editor);
  card.appendChild(hdr); card.appendChild(body);
  return card;
}

// ── SYNC ─────────────────────────────────────────────────────────
async function syncDay(key) {
  if (!session) return;
  setSyncState('syncing');
  try {
    if (db[key]) {
      await sb.upsertDay(session.token, session.userId, key, db[key]);
    } else {
      await sb.deleteDay(session.token, session.userId, key);
    }
    // Mark this key as successfully synced with current content hash
    const synced = JSON.parse(localStorage.getItem('ps_synced') || '{}');
    synced[key] = { ts: Date.now(), len: (db[key] || '').length };
    localStorage.setItem('ps_synced', JSON.stringify(synced));
    setSyncState('ok');
  } catch(e) { setSyncState('error'); }
}

async function syncNotes(content) {
  if (!session) return;
  setSyncState('syncing');
  try {
    await sb.upsertNotes(session.token, session.userId, content);
    setSyncState('ok');
  } catch(e) { setSyncState('error'); }
}

// ── TOOLBAR ──────────────────────────────────────────────────────
const toolbar = document.getElementById('toolbar');
const bottomNav = document.getElementById('bottom-nav');
function positionToolbar() {
  const tbDv = document.getElementById('toolbar-dv');
  const active = (tbDv && tbDv.classList.contains('show')) ? tbDv : toolbar.classList.contains('show') ? toolbar : null;
  if (!active) return;
  if (window.visualViewport) {
    const vv = window.visualViewport;
    active.classList.add('floating');
    active.style.top = (vv.offsetTop + vv.height - active.offsetHeight) + 'px';
    bottomNav.style.visibility = vv.height < window.innerHeight * 0.75 ? 'hidden' : 'visible';
  } else { active.classList.remove('floating'); active.style.top = ''; bottomNav.style.visibility = 'visible'; }
}
function showToolbar(which) {
  const tbDv = document.getElementById('toolbar-dv');
  if (which === 'dv') { if (tbDv) tbDv.classList.add('show'); toolbar.classList.remove('show', 'floating'); }
  else { toolbar.classList.add('show'); if (tbDv) tbDv.classList.remove('show', 'floating'); }
  positionToolbar();
}
function hideToolbar(which) {
  const tbDv = document.getElementById('toolbar-dv');
  if (which === 'dv') { if (tbDv) { tbDv.classList.remove('show', 'floating'); tbDv.style.top = ''; } }
  else { toolbar.classList.remove('show', 'floating'); toolbar.style.top = ''; }
  bottomNav.style.visibility = 'visible';
}


if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', positionToolbar);
  window.visualViewport.addEventListener('scroll', positionToolbar);
}
function placeCaretAtEnd(el) {
  const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function saveRange() { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange(); }
function restoreRange() { if (!savedRange || !activeEditor) return; try { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); } catch(e) {} }
function fmt(cmd, val) {
  if (!activeEditor) return;
  activeEditor.focus();
  // Only restore range if selection is currently collapsed or outside editor
  const sel = window.getSelection();
  const hasSelection = sel && !sel.isCollapsed && activeEditor.contains(sel.anchorNode);
  if (!hasSelection) restoreRange();
  document.execCommand(cmd, false, val || null);
  saveRange();
  activeEditor === document.getElementById('dv-editor') ? updateDvToolbarState() : updateToolbarState();
  activeEditor.dispatchEvent(new Event('input'));
}
function toggleBullet() {
  if (!activeEditor) return;
  activeEditor.focus(); restoreRange();
  const isActive = document.queryCommandState('insertUnorderedList');
  document.execCommand('insertUnorderedList', false, null);
  if (isActive) activeEditor.normalize();
  saveRange();
  activeEditor === document.getElementById('dv-editor') ? updateDvToolbarState() : updateToolbarState();
  activeEditor.dispatchEvent(new Event('input'));
}
function updateToolbarState() {
  if (!activeEditor) return; saveRange();
  ['bold','italic','underline','strikeThrough','insertUnorderedList'].forEach(cmd => {
    const map = { bold:'tb-bold', italic:'tb-italic', underline:'tb-under', strikeThrough:'tb-strike', insertUnorderedList:'tb-ul' };
    document.getElementById(map[cmd]).classList.toggle('on', document.queryCommandState(cmd));
  });
}
function tbBind(id, fn) {
  const el = document.getElementById(id);
  el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
  el.addEventListener('touchend', e => { e.preventDefault(); fn(); });
}
tbBind('tb-bold', () => fmt('bold'));
tbBind('tb-italic', () => fmt('italic'));
tbBind('tb-under', () => fmt('underline'));
tbBind('tb-strike', () => fmt('strikeThrough'));
tbBind('tb-ul', toggleBullet);
document.getElementById('cur-color').addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); document.getElementById('color-menu').classList.toggle('show'); });
document.querySelectorAll('.cm-dot').forEach(dot => {
  const apply = function(e) {
    e.preventDefault(); e.stopPropagation();
    currentColor = this.dataset.color;
    document.getElementById('cur-color').style.background = currentColor;
    document.querySelectorAll('.cm-dot').forEach(d => d.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('color-menu').classList.remove('show');
    fmt('foreColor', currentColor);
  };
  dot.addEventListener('mousedown', apply); dot.addEventListener('touchend', apply);
});
document.addEventListener('click', e => { if (!e.target.closest('.color-picker-wrap')) document.getElementById('color-menu').classList.remove('show'); });

// ── NAVIGATION ───────────────────────────────────────────────────
document.getElementById('nav-agenda').onclick = () => { setNav('agenda'); document.getElementById('appunti-overlay').classList.remove('show'); };
document.getElementById('nav-appunti').onclick = () => {
  setNav('appunti');
  document.getElementById('notes-area').value = localStorage.getItem('ps_notes') || '';
  document.getElementById('appunti-overlay').classList.add('show');
};
document.getElementById('nav-oggi').onclick = () => {
  weekOffset = 0; renderWeek(); setNav('oggi');
  const today = new Date(); today.setHours(0,0,0,0);
  const key = dayKey(today);
  setTimeout(() => {
    const ed = document.querySelector('.day-editor[data-key="' + key + '"]');
    if (ed) { ed.focus(); placeCaretAtEnd(ed); }
  }, 120);
};
document.getElementById('nav-menu').onclick = () => { setNav('menu'); document.getElementById('menu-overlay').classList.add('show'); };
document.getElementById('appunti-close').onclick = () => { document.getElementById('appunti-overlay').classList.remove('show'); setNav('agenda'); };
document.getElementById('appunti-overlay').onclick = e => { if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); setNav('agenda'); } };
document.getElementById('menu-close').onclick = () => { document.getElementById('menu-overlay').classList.remove('show'); setNav('agenda'); };
document.getElementById('menu-overlay').onclick = e => { if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); setNav('agenda'); } };

document.getElementById('save-note-btn').onclick = function() {
  const content = document.getElementById('notes-area').value;
  localStorage.setItem('ps_notes', content);
  syncNotes(content);
  this.textContent = 'Salvato!'; setTimeout(() => this.textContent = 'Salva appunti', 1500);
};

function setNav(w) { ['agenda','appunti','oggi','menu'].forEach(n => document.getElementById('nav-' + n).classList.toggle('active', n === w)); }

// ── LOGOUT ───────────────────────────────────────────────────────
document.getElementById('btn-logout').onclick = async () => {
  if (!confirm('Vuoi uscire dall\'account?')) return;
  await sb.signOut(session.token);
  session = null; db = {};
  localStorage.removeItem('sb_session');
  localStorage.removeItem('ps_cache');
  localStorage.removeItem('ps_notes');
  document.getElementById('menu-overlay').classList.remove('show');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  showTab('login');
};

// ── EXPORT / IMPORT ──────────────────────────────────────────────
document.getElementById('btn-export').onclick = () => {
  const payload = { version: 1, exported: new Date().toISOString(), agenda: db, notes: localStorage.getItem('ps_notes') || '' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'agendabb-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
};
document.getElementById('btn-import').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').addEventListener('change', async function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.version || !data.agenda) { alert('File non valido.'); return; }
      if (!confirm('Importare i dati? I dati attuali verranno sostituiti.')) return;
      db = data.agenda; saveCache();
      if (data.notes) localStorage.setItem('ps_notes', data.notes);
      // Sync all to cloud
      setSyncState('syncing');
      for (const [key, content] of Object.entries(db)) {
        await sb.upsertDay(session.token, session.userId, key, content);
      }
      if (data.notes) await sb.upsertNotes(session.token, session.userId, data.notes);
      setSyncState('ok');
      renderWeek();
      document.getElementById('menu-overlay').classList.remove('show');
      setNav('agenda');
      alert('Dati importati e sincronizzati!');
    } catch(err) { alert('Errore nella lettura del file.'); }
  };
  reader.readAsText(file); this.value = '';
});

// ── SWIPE ────────────────────────────────────────────────────────
let swipeX = 0, swipeY = 0, mX = 0, mDown = false;
const nb = document.getElementById('notebook');
nb.addEventListener('touchstart', e => { if (isEditing) return; swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; }, { passive: true });
nb.addEventListener('touchend', e => {
  if (isEditing) return;
  const dx = e.changedTouches[0].clientX - swipeX;
  const dy = e.changedTouches[0].clientY - swipeY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); }
}, { passive: true });
nb.addEventListener('mousedown', e => { if (isEditing || e.target.isContentEditable || e.target.closest('[contenteditable]')) return; mX = e.clientX; mDown = true; });
nb.addEventListener('mouseup', e => { if (!mDown || isEditing) return; mDown = false; const dx = e.clientX - mX; if (Math.abs(dx) > 45) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); } });

// ── CALENDAR ─────────────────────────────────────────────────────
function renderCal() {
  const grid = document.getElementById('cgrid'); grid.innerHTML = '';
  document.getElementById('cal-label').textContent = MFULL[calM] + ' ' + calY;
  ['Lu','Ma','Me','Gi','Ve','Sa','Do'].forEach(d => { const h = document.createElement('div'); h.className = 'cdh'; h.textContent = d; grid.appendChild(h); });
  const today = new Date(); today.setHours(0,0,0,0);
  const curMon = getMonday(weekOffset), curSun = new Date(curMon); curSun.setDate(curMon.getDate() + 6);
  const first = new Date(calY, calM, 1); let sd = first.getDay(); if (sd === 0) sd = 7;
  for (let i = 1; i < sd; i++) { const e = document.createElement('div'); e.className = 'cd empty'; grid.appendChild(e); }
  const dim = new Date(calY, calM + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const cell = document.createElement('div'); cell.className = 'cd';
    const dt = new Date(calY, calM, d); dt.setHours(0,0,0,0);
    if (dt >= curMon && dt <= curSun) cell.classList.add('cur-week');
    if (dt.getTime() === today.getTime()) cell.classList.add('today-c');
    cell.textContent = d;
    cell.addEventListener('click', ev => {
      ev.stopPropagation();
      const todayD = new Date(); todayD.setHours(0,0,0,0);
      const dow = todayD.getDay(), diff = dow === 0 ? -6 : 1 - dow;
      const thisMon = new Date(todayD); thisMon.setDate(todayD.getDate() + diff);
      const cdt = new Date(calY, calM, d); cdt.setHours(0,0,0,0);
      const cdow = cdt.getDay(), cdiff = cdow === 0 ? -6 : 1 - cdow;
      const cmon = new Date(cdt); cmon.setDate(cdt.getDate() + cdiff);
      weekOffset = Math.round((cmon - thisMon) / (7 * 86400000));
      renderWeek(); document.getElementById('cal-wrap').classList.remove('show');
    });
    grid.appendChild(cell);
  }
}
document.getElementById('open-cal').addEventListener('click', e => { e.stopPropagation(); const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); renderCal(); document.getElementById('cal-wrap').classList.add('show'); });
document.getElementById('cal-prev').addEventListener('click', e => { e.stopPropagation(); calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
document.getElementById('cal-next').addEventListener('click', e => { e.stopPropagation(); calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });
document.getElementById('cal-close').addEventListener('click', e => { e.stopPropagation(); document.getElementById('cal-wrap').classList.remove('show'); });
document.getElementById('cal-wrap').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
document.getElementById('cal-box').addEventListener('click', e => e.stopPropagation());

// Save immediately when user leaves the page/app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && activeEditor) {
    const key = activeEditor.dataset.key;
    if (key) {
      const html = activeEditor.innerHTML;
      if (html && html !== '<br>' && html !== '') db[key] = html; else delete db[key];
      saveCache();
      syncDay(key);
    }
  }
});

wireDayViewEvents();
renderWeek();
