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
    // No expansion — keep layout stable to prevent iOS scroll jump
    showToolbar('main'); updateToolbarState();
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
