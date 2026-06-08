const DAYS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MFULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

let db = JSON.parse(localStorage.getItem('ps_v8') || '{}');
function save() { localStorage.setItem('ps_v8', JSON.stringify(db)); }
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

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
    save();
    clearTimeout(dvSaveTimer);
    dvSaveTimer = setTimeout(() => {
      
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

// ── TOOLBAR POSITIONING ──────────────────────────────────────────
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
  if (which === 'dv') { if(tbDv) tbDv.classList.add('show'); toolbar.classList.remove('show','floating'); }
  else { toolbar.classList.add('show'); if(tbDv) tbDv.classList.remove('show','floating'); }
  positionToolbar();
}
function hideToolbar(which) {
  const tbDv = document.getElementById('toolbar-dv');
  if (which === 'dv') { if(tbDv) { tbDv.classList.remove('show','floating'); tbDv.style.top=''; } }
  else { toolbar.classList.remove('show','floating'); toolbar.style.top = ''; }
  bottomNav.style.visibility = 'visible';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', positionToolbar);
  window.visualViewport.addEventListener('scroll', positionToolbar);
}
// ────────────────────────────────────────────────────────────────

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
  const saved = db[key] || ''; if (saved) editor.innerHTML = saved;

  let saveTimer = null;
  editor.addEventListener('input', function() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const html = this.innerHTML;
      if (html && html !== '<br>' && html.trim() !== '') db[key] = html; else delete db[key]; save();
    }, 400);
  });
  editor.addEventListener('focus', function() {
    activeEditor = this; isEditing = true;
    const nb = document.getElementById('notebook');
    card.classList.add('active');
    showToolbar('main'); updateToolbarState();
    if (nb) {
      requestAnimationFrame(() => {
        const cardTop = card.offsetTop;
        if (cardTop < nb.scrollTop) {
          nb.scrollTop = cardTop;
        }
        setTimeout(() => {
          if (card.offsetTop < nb.scrollTop) nb.scrollTop = card.offsetTop;
        }, 80);
      });
    }
  });
  editor.addEventListener('blur', function() {
    setTimeout(() => {
      if (!toolbar.contains(document.activeElement) && document.activeElement !== this) {
        card.classList.remove('active');
        if (activeEditor === this) { activeEditor = null; isEditing = false; hideToolbar('main'); }
      }
    }, 150);
  });
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  body.addEventListener('click', function(e) {
    if (e.target === body || e.target === lines) { editor.focus(); placeCaretAtEnd(editor); }
  });
  body.addEventListener('touchmove', function(e) { if (isEditing) e.stopPropagation(); }, { passive: true });
  hdr.addEventListener('click', () => openDay(d));
  body.appendChild(lines); body.appendChild(editor);
  card.appendChild(hdr); card.appendChild(body);
  return card;
}

function placeCaretAtEnd(el) {
  const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function saveRange() {
  const sel = window.getSelection(); if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
}
function restoreRange() {
  if (!savedRange || !activeEditor) return;
  try { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); } catch(e) {}
}

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
  document.getElementById('tb-bold').classList.toggle('on', document.queryCommandState('bold'));
  document.getElementById('tb-italic').classList.toggle('on', document.queryCommandState('italic'));
  document.getElementById('tb-under').classList.toggle('on', document.queryCommandState('underline'));
  document.getElementById('tb-strike').classList.toggle('on', document.queryCommandState('strikeThrough'));
  document.getElementById('tb-ul').classList.toggle('on', document.queryCommandState('insertUnorderedList'));
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

document.getElementById('cur-color').addEventListener('mousedown', function(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('color-menu').classList.toggle('show');
});
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
document.addEventListener('click', e => {
  if (!e.target.closest('.color-picker-wrap')) document.getElementById('color-menu').classList.remove('show');
});

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
document.getElementById('appunti-close').onclick = () => { document.getElementById('appunti-overlay').classList.remove('show'); setNav('agenda'); };
document.getElementById('appunti-overlay').onclick = e => { if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); setNav('agenda'); } };
document.getElementById('save-note-btn').onclick = function() {
  localStorage.setItem('ps_notes', document.getElementById('notes-area').value);
  this.textContent = 'Salvato!'; setTimeout(() => this.textContent = 'Salva appunti', 1500);
};
function setNav(w) { ['agenda','appunti','oggi'].forEach(n => { const el = document.getElementById('nav-' + n); if(el) el.classList.toggle('active', n === w); }); }

let swipeX = 0, mX = 0, mDown = false;
const nb = document.getElementById('notebook');
nb.addEventListener('touchstart', e => { if (isEditing) return; swipeX = e.touches[0].clientX; }, { passive: true });
nb.addEventListener('touchend', e => { if (isEditing) return; const dx = e.changedTouches[0].clientX - swipeX; if (Math.abs(dx) > 55) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); } }, { passive: true });
nb.addEventListener('mousedown', e => { if (e.target.isContentEditable || e.target.closest('[contenteditable]')) return; mX = e.clientX; mDown = true; });
nb.addEventListener('mouseup', e => { if (!mDown) return; mDown = false; const dx = e.clientX - mX; if (Math.abs(dx) > 55) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); } });

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


// ── SERVICE WORKER ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          const banner = document.getElementById('update-banner');
          if (banner) {
            banner.classList.add('show');
            banner.onclick = () => { newSW.postMessage({ type: 'SKIP_WAITING' }); window.location.reload(); };
          }
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

// ── EXPORT / IMPORT ──────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    agenda: JSON.parse(localStorage.getItem('ps_v8') || '{}'),
    notes: localStorage.getItem('ps_notes') || ''
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agendabb-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.version || !data.agenda) { alert('File non valido.'); return; }
      if (!confirm('Importare i dati? I dati attuali verranno sostituiti.')) return;
      localStorage.setItem('ps_v8', JSON.stringify(data.agenda));
      if (data.notes) localStorage.setItem('ps_notes', data.notes);
      db = data.agenda;
      renderWeek();
      document.getElementById('menu-overlay').classList.remove('show');
      setNav('agenda');
      alert('Dati importati con successo!');
    } catch(err) { alert('Errore nella lettura del file.'); }
  };
  reader.readAsText(file);
  this.value = '';
});

// ── MENU NAV ─────────────────────────────────────────────────────
document.getElementById('nav-menu').addEventListener('click', () => {
  setNav('menu');
  document.getElementById('menu-overlay').classList.add('show');
});
document.getElementById('menu-close').addEventListener('click', () => {
  document.getElementById('menu-overlay').classList.remove('show');
  setNav('agenda');
});
document.getElementById('menu-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); setNav('agenda'); }
});
wireDayViewEvents();
renderWeek();
