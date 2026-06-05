const DAYS = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MFULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

let db = JSON.parse(localStorage.getItem('ps_v5') || '{}');
function save() { localStorage.setItem('ps_v5', JSON.stringify(db)); }
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let weekOffset = 0;
let calY, calM;
let activeAddKey = null;
let activeAddType = 'task';

function getMonday(offset) {
  const t = new Date(); t.setHours(0,0,0,0);
  const dow = t.getDay(); const diff = dow === 0 ? -6 : 1 - dow;
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

  const left = document.getElementById('left-col');
  const right = document.getElementById('right-col');
  left.innerHTML = ''; right.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);

  [days[0], days[1], days[2]].forEach(d => left.appendChild(makeCard(d, today, false)));
  [days[3], days[4]].forEach(d => right.appendChild(makeCard(d, today, false)));

  const wkWrap = document.createElement('div');
  wkWrap.className = 'weekend-wrap';
  [days[5], days[6]].forEach(d => {
    const c = makeCard(d, today, true); c.style.flex = '1'; wkWrap.appendChild(c);
  });
  right.appendChild(wkWrap);
  setTimeout(buildSpiral, 80);
}

function makeCard(d, today, small) {
  const key = dayKey(d);
  const isToday = d.getTime() === today.getTime();
  const card = document.createElement('div');
  card.className = 'day-card'; card.dataset.key = key;

  const hdr = document.createElement('div');
  hdr.className = 'day-hdr' + (isToday ? ' today' : '');
  hdr.innerHTML = '<span class="dow">' + DAYS[d.getDay()] + '</span><span class="num">' + d.getDate() + '</span><span class="mon-lbl">' + MONTHS[d.getMonth()] + '</span>';
  hdr.onclick = () => openAdd(key);

  const body = document.createElement('div');
  body.className = 'day-body' + (small ? ' weekend-body' : '');
  body.dataset.key = key;
  body.onclick = function(e) { if (e.target === body) openAdd(key); }
  refreshBody(body, key);

  const addZone = document.createElement('div');
  addZone.className = 'add-zone'; addZone.id = 'az-' + key;
  addZone.innerHTML =
    '<div class="type-toggle">' +
      '<button class="type-btn on" id="tt-task-' + key + '" onclick="setAddType(\'task\',\'' + key + '\')"><i class="ti ti-checkbox" aria-hidden="true"></i> Lista</button>' +
      '<button class="type-btn" id="tt-note-' + key + '" onclick="setAddType(\'note\',\'' + key + '\')"><i class="ti ti-pencil" aria-hidden="true"></i> Testo</button>' +
    '</div>' +
    '<input class="add-inp" id="ainp-' + key + '" placeholder="Scrivi e premi Invio..." />' +
    '<div class="add-row-btns">' +
      '<button class="add-ok" onclick="commitAdd(\'' + key + '\')">Aggiungi</button>' +
      '<button class="add-cancel" onclick="closeAdd(\'' + key + '\')">Chiudi</button>' +
    '</div>';

  card.appendChild(hdr); card.appendChild(body); card.appendChild(addZone);
  return card;
}

function refreshBody(body, key) {
  body.innerHTML = '';
  const entries = db[key] || [];
  entries.forEach(e => {
    const row = document.createElement('div');
    row.className = 'entry-row' + (e.type === 'note' ? ' note-type' : '');
    row.dataset.id = e.id;
    if (e.type === 'task') {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!e.done;
      cb.onclick = function(ev) {
        ev.stopPropagation(); e.done = !e.done; save();
        const sp = row.querySelector('.txt'); if (sp) sp.className = 'txt' + (e.done ? ' done' : '');
      };
      const sp = document.createElement('span');
      sp.className = 'txt' + (e.done ? ' done' : ''); sp.textContent = e.text;
      sp.onclick = ev => { ev.stopPropagation(); startEdit(key, e.id, row); };
      const acts = document.createElement('div'); acts.className = 'act-btns';
      acts.innerHTML = '<button class="act-btn del" title="Elimina" onclick="delEntry(\'' + key + '\',' + e.id + ',event)"><i class="ti ti-trash" aria-hidden="true"></i></button>';
      row.appendChild(cb); row.appendChild(sp); row.appendChild(acts);
    } else {
      const sp = document.createElement('span'); sp.className = 'txt';
      sp.textContent = e.text.length > 50 ? e.text.substring(0, 50) + '…' : e.text;
      sp.onclick = ev => { ev.stopPropagation(); startEdit(key, e.id, row); };
      const acts = document.createElement('div'); acts.className = 'act-btns';
      acts.innerHTML = '<button class="act-btn del" title="Elimina" onclick="delEntry(\'' + key + '\',' + e.id + ',event)"><i class="ti ti-trash" aria-hidden="true"></i></button>';
      row.appendChild(sp); row.appendChild(acts);
    }
    body.appendChild(row);
  });
}

function startEdit(key, id, row) {
  if (row.querySelector('.edit-row')) return;
  const entries = db[key] || [];
  const entry = entries.find(x => x.id === id); if (!entry) return;
  const existing = row.querySelector('.txt'); if (existing) existing.style.display = 'none';
  const acts = row.querySelector('.act-btns'); if (acts) acts.style.display = 'none';
  const er = document.createElement('div'); er.className = 'edit-row';
  const inp = document.createElement('input'); inp.className = 'edit-inp'; inp.value = entry.text; inp.type = 'text';
  const ok = document.createElement('button'); ok.className = 'edit-ok'; ok.textContent = 'Ok';
  const cancel = document.createElement('button'); cancel.className = 'edit-cancel'; cancel.textContent = '✕';
  ok.onclick = function(e) {
    e.stopPropagation(); const v = inp.value.trim(); if (!v) return;
    entry.text = v; save();
    const body = document.querySelector('.day-body[data-key="' + key + '"]');
    if (body) refreshBody(body, key);
  };
  cancel.onclick = function(e) {
    e.stopPropagation();
    const body = document.querySelector('.day-body[data-key="' + key + '"]');
    if (body) refreshBody(body, key);
  };
  inp.onkeydown = function(e) {
    if (e.key === 'Enter') ok.click();
    if (e.key === 'Escape') cancel.click();
    e.stopPropagation();
  };
  er.appendChild(inp); er.appendChild(ok); er.appendChild(cancel);
  row.appendChild(er); setTimeout(() => inp.focus(), 30);
}

function delEntry(key, id, e) {
  if (e) e.stopPropagation();
  db[key] = (db[key] || []).filter(x => x.id !== id); save();
  const body = document.querySelector('.day-body[data-key="' + key + '"]');
  if (body) refreshBody(body, key);
}

function openAdd(key) {
  if (activeAddKey && activeAddKey !== key) closeAdd(activeAddKey);
  activeAddKey = key; activeAddType = 'task';
  const az = document.getElementById('az-' + key); if (az) az.classList.add('open');
  const tt = document.getElementById('tt-task-' + key); if (tt) tt.classList.add('on');
  const tn = document.getElementById('tt-note-' + key); if (tn) tn.classList.remove('on');
  const inp = document.getElementById('ainp-' + key);
  if (inp) setTimeout(() => inp.focus(), 50);
}

function closeAdd(key) {
  const az = document.getElementById('az-' + key); if (az) az.classList.remove('open');
  const inp = document.getElementById('ainp-' + key); if (inp) inp.value = '';
  if (activeAddKey === key) activeAddKey = null;
}

function setAddType(type, key) {
  activeAddType = type;
  document.getElementById('tt-task-' + key).classList.toggle('on', type === 'task');
  document.getElementById('tt-note-' + key).classList.toggle('on', type === 'note');
}

function commitAdd(key) {
  const inp = document.getElementById('ainp-' + key); if (!inp) return;
  const v = inp.value.trim(); if (!v) return;
  if (!db[key]) db[key] = [];
  db[key].push({ id: Date.now(), type: activeAddType, text: v, done: false });
  save(); inp.value = '';
  const body = document.querySelector('.day-body[data-key="' + key + '"]');
  if (body) refreshBody(body, key);
  setTimeout(() => inp.focus(), 30);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && activeAddKey && document.activeElement === document.getElementById('ainp-' + activeAddKey)) commitAdd(activeAddKey);
  if (e.key === 'Escape' && activeAddKey) closeAdd(activeAddKey);
});

document.getElementById('prev-btn').onclick = function() { weekOffset--; renderWeek(); };
document.getElementById('next-btn').onclick = function() { weekOffset++; renderWeek(); };

document.getElementById('nav-agenda').onclick = function() {
  setNav('agenda'); document.getElementById('appunti-overlay').classList.remove('show');
};
document.getElementById('nav-appunti').onclick = function() {
  setNav('appunti');
  document.getElementById('notes-area').value = localStorage.getItem('ps_notes') || '';
  document.getElementById('appunti-overlay').classList.add('show');
};
document.getElementById('nav-oggi').onclick = function() {
  setNav('agenda'); weekOffset = 0; renderWeek();
  const today = new Date(); today.setHours(0,0,0,0);
  setTimeout(() => openAdd(dayKey(today)), 150);
};
document.getElementById('appunti-close').onclick = function() {
  document.getElementById('appunti-overlay').classList.remove('show'); setNav('agenda');
};
document.getElementById('appunti-overlay').onclick = function(e) {
  if (e.target === this) { this.classList.remove('show'); setNav('agenda'); }
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
  if (Math.abs(dx) > 45) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); }
}, { passive: true });
nb.addEventListener('mousedown', e => { mX = e.clientX; mDown = true; nb.classList.add('dragging'); });
nb.addEventListener('mouseup', e => {
  if (!mDown) return; nb.classList.remove('dragging');
  const dx = e.clientX - mX;
  if (Math.abs(dx) > 45) { dx < 0 ? weekOffset++ : weekOffset--; renderWeek(); }
  mDown = false;
});
nb.addEventListener('mouseleave', () => { mDown = false; nb.classList.remove('dragging'); });

// Calendario
function renderCal() {
  const grid = document.getElementById('cgrid'); grid.innerHTML = '';
  document.getElementById('cal-label').textContent = MFULL[calM] + ' ' + calY;
  ['Lu','Ma','Me','Gi','Ve','Sa','Do'].forEach(d => {
    const h = document.createElement('div'); h.className = 'cdh'; h.textContent = d; grid.appendChild(h);
  });
  const today = new Date(); today.setHours(0,0,0,0);
  const curMon = getMonday(weekOffset);
  const curSun = new Date(curMon); curSun.setDate(curMon.getDate() + 6);
  const first = new Date(calY, calM, 1);
  let sd = first.getDay(); if (sd === 0) sd = 7;
  for (let i = 1; i < sd; i++) { const e = document.createElement('div'); e.className = 'cd empty'; grid.appendChild(e); }
  const dim = new Date(calY, calM + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const cell = document.createElement('div'); cell.className = 'cd';
    const dt = new Date(calY, calM, d); dt.setHours(0,0,0,0);
    if (dt >= curMon && dt <= curSun) cell.classList.add('cur-week');
    if (dt.getTime() === today.getTime()) cell.classList.add('today-c');
    cell.textContent = d;
    cell.addEventListener('click', function(ev) {
      ev.stopPropagation();
      const todayD = new Date(); todayD.setHours(0,0,0,0);
      const dow = todayD.getDay(); const diff = dow === 0 ? -6 : 1 - dow;
      const thisMon = new Date(todayD); thisMon.setDate(todayD.getDate() + diff);
      const clickedDt = new Date(calY, calM, d); clickedDt.setHours(0,0,0,0);
      const cdow = clickedDt.getDay(); const cdiff = cdow === 0 ? -6 : 1 - cdow;
      const clickedMon = new Date(clickedDt); clickedMon.setDate(clickedDt.getDate() + cdiff);
      weekOffset = Math.round((clickedMon - thisMon) / (7 * 86400000));
      renderWeek();
      document.getElementById('cal-wrap').classList.remove('show');
    });
    grid.appendChild(cell);
  }
}

document.getElementById('open-cal').addEventListener('click', function(e) {
  e.stopPropagation();
  const t = new Date(); calY = t.getFullYear(); calM = t.getMonth();
  renderCal(); document.getElementById('cal-wrap').classList.add('show');
});
document.getElementById('cal-prev').addEventListener('click', function(e) { e.stopPropagation(); calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
document.getElementById('cal-next').addEventListener('click', function(e) { e.stopPropagation(); calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });
document.getElementById('cal-close').addEventListener('click', function(e) { e.stopPropagation(); document.getElementById('cal-wrap').classList.remove('show'); });
document.getElementById('cal-wrap').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
document.getElementById('cal-box').addEventListener('click', function(e) { e.stopPropagation(); });

renderWeek();
