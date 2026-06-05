const DAYS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MFULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

let db = JSON.parse(localStorage.getItem('ps_v8') || '{}');
function save() { localStorage.setItem('ps_v8', JSON.stringify(db)); }
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

let weekOffset = 0, calY, calM;
let activeEditor = null;
let savedRange = null;
let currentColor = '#1a1a1a';

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
  document.getElementById('hdr-month').textContent = MONTHS[mon.getMonth()] + ' ' + mon.getFullYear();
  document.getElementById('hdr-week').textContent = 'Settim ' + getWeekNum(mon);
  document.getElementById('week-range').textContent =
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
  const card = document.createElement('div');
  card.className = 'day-card'; card.dataset.key = key;

  const hdr = document.createElement('div');
  hdr.className = 'day-hdr' + (isToday ? ' today' : '');
  hdr.innerHTML = '<span class="dow">' + DAYS[d.getDay()] + '</span><span class="num">' + d.getDate() + '</span><span class="mon-lbl">' + MONTHS[d.getMonth()] + '</span>';

  const body = document.createElement('div'); body.className = 'day-body';
  const lines = document.createElement('div'); lines.className = 'day-lines';

  const editor = document.createElement('div');
  editor.className = 'day-editor';
  editor.contentEditable = 'true';
  editor.setAttribute('data-placeholder', 'Tocca per scrivere...');
  editor.setAttribute('spellcheck', 'true');
  editor.dataset.key = key;

  const saved = db[key] || '';
  if (saved) editor.innerHTML = saved;

  let saveTimer = null;
  editor.addEventListener('input', function() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const html = this.innerHTML.replace(/<br\s*\/?>\s*$/, '');
      if (html && html !== '<br>') db[key] = html;
      else delete db[key];
      save();
    }, 400);
  });

  editor.addEventListener('focus', function() {
    activeEditor = this;
    card.classList.add('active');
    document.getElementById('toolbar').classList.add('show');
    updateToolbarState();
  });

  editor.addEventListener('blur', function() {
    setTimeout(() => {
      const toolbar = document.getElementById('toolbar');
      if (!toolbar.contains(document.activeElement) && document.activeElement !== this) {
        card.classList.remove('active');
        if (activeEditor === this) {
          activeEditor = null;
          toolbar.classList.remove('show');
        }
      }
    }, 150);
  });

  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);

  body.addEventListener('click', function(e) {
    if (e.target === body || e.target === lines) {
      editor.focus();
      placeCaretAtEnd(editor);
    }
  });
  hdr.addEventListener('click', () => { editor.focus(); placeCaretAtEnd(editor); });

  body.appendChild(lines); body.appendChild(editor);
  card.appendChild(hdr); card.appendChild(body);
  return card;
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}

function saveRange() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
}
function restoreRange() {
  if (!savedRange) return;
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
}

function fmt(cmd, val) {
  if (!activeEditor) return;
  activeEditor.focus();
  restoreRange();
  document.execCommand(cmd, false, val || null);
  saveRange();
  updateToolbarState();
  activeEditor.dispatchEvent(new Event('input'));
}

function updateToolbarState() {
  if (!activeEditor) return;
  saveRange();
  document.getElementById('tb-bold').classList.toggle('on', document.queryCommandState('bold'));
  document.getElementById('tb-italic').classList.toggle('on', document.queryCommandState('italic'));
  document.getElementById('tb-under').classList.toggle('on', document.queryCommandState('underline'));
  document.getElementById('tb-strike').classList.toggle('on', document.queryCommandState('strikeThrough'));
  document.getElementById('tb-ul').classList.toggle('on', document.queryCommandState('insertUnorderedList'));
  document.getElementById('tb-ol').classList.toggle('on', document.queryCommandState('insertOrderedList'));
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
tbBind('tb-ul', () => fmt('insertUnorderedList'));
tbBind('tb-ol', () => fmt('insertOrderedList'));

document.getElementById('tb-size').addEventListener('mousedown', e => e.stopPropagation());
document.getElementById('tb-size').addEventListener('change', function() {
  if (activeEditor) { activeEditor.focus(); restoreRange(); }
  document.execCommand('fontSize', false, '7');
  const spans = (activeEditor || document).querySelectorAll('font[size="7"]');
  spans.forEach(s => { s.removeAttribute('size'); s.style.fontSize = this.value + 'px'; });
  if (activeEditor) activeEditor.dispatchEvent(new Event('input'));
});

document.getElementById('cur-color').addEventListener('mousedown', function(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('color-menu').classList.toggle('show');
});

document.querySelectorAll('.cm-dot').forEach(dot => {
  const applyColor = function(e) {
    e.preventDefault(); e.stopPropagation();
    currentColor = this.dataset.color;
    document.getElementById('cur-color').style.background = currentColor;
    document.querySelectorAll('.cm-dot').forEach(d => d.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('color-menu').classList.remove('show');
    fmt('foreColor', currentColor);
  };
  dot.addEventListener('mousedown', applyColor);
  dot.addEventListener('touchend', applyColor);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.color-picker-wrap'))
    document.getElementById('color-menu').classList.remove('show');
});

// Navigation
document.getElementById('prev-btn').onclick = () => { weekOffset--; renderWeek(); };
document.getElementById('next-btn').onclick = () => { weekOffset++; renderWeek(); };

document.getElementById('nav-agenda').onclick = () => {
  setNav('agenda'); document.getElementById('appunti-overlay').classList.remove('show');
};
document.getElementById('nav-appunti').onclick = () => {
  setNav('appunti');
  document.getElementById('notes-area').value = localStorage.getItem('ps_notes') || '';
  document.getElementById('appunti-overlay').classList.add('show');
};
document.getElementById('nav-oggi').onclick = () => {
  setNav('agenda'); weekOffset = 0; renderWeek();
  const today = new Date(); today.setHours(0,0,0,0);
  setTimeout(() => {
    const ed = document.querySelector('.day-editor[data-key="' + dayKey(today) + '"]');
    if (ed) { ed.focus(); placeCaretAtEnd(ed); }
  }, 150);
};
document.getElementById('appunti-close').onclick = () => {
  document.getElementById('appunti-overlay').classList.remove('show'); setNav('agenda');
};
document.getElementById('appunti-overlay').onclick = e => {
  if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); setNav('agenda'); }
};
document.getElementById('save-note-btn').onclick = function() {
  localStorage.setItem('ps_notes', document.getElementById('notes-area').value);
  this.textContent = 'Salvato!'; setTimeout(() => this.textContent = 'Salva appunti', 1500);
};

function setNav(w) {
  ['agenda','appunti','oggi'].forEach(n => document.getElementById('nav-' + n).classList.toggle('active', n === w));
}

// Swipe
let swipeX = 0, mX = 0, mDown = false;
const nb = document.getElementById('notebook');
nb.addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; }, { passive: true });
nb.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - swipeX;
  if (Math.abs(dx) > 55) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); }
}, { passive: true });
nb.addEventListener('mousedown', e => {
  if (e.target.isContentEditable || e.target.closest('[contenteditable]')) return;
  mX = e.clientX; mDown = true;
});
nb.addEventListener('mouseup', e => {
  if (!mDown) return; mDown = false;
  const dx = e.clientX - mX;
  if (Math.abs(dx) > 55) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); }
});

// Calendar
function renderCal() {
  const grid = document.getElementById('cgrid'); grid.innerHTML = '';
  document.getElementById('cal-label').textContent = MFULL[calM] + ' ' + calY;
  ['Lu','Ma','Me','Gi','Ve','Sa','Do'].forEach(d => {
    const h = document.createElement('div'); h.className = 'cdh'; h.textContent = d; grid.appendChild(h);
  });
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
document.getElementById('open-cal').addEventListener('click', e => {
  e.stopPropagation(); const t = new Date(); calY = t.getFullYear(); calM = t.getMonth();
  renderCal(); document.getElementById('cal-wrap').classList.add('show');
});
document.getElementById('cal-prev').addEventListener('click', e => { e.stopPropagation(); calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
document.getElementById('cal-next').addEventListener('click', e => { e.stopPropagation(); calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });
document.getElementById('cal-close').addEventListener('click', e => { e.stopPropagation(); document.getElementById('cal-wrap').classList.remove('show'); });
document.getElementById('cal-wrap').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
document.getElementById('cal-box').addEventListener('click', e => e.stopPropagation());

renderWeek();
