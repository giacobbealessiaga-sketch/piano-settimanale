// ═══════════════════════════════════════════════════════════════
// Ricettario — database condiviso fra tutti gli utenti autenticati.
// Due tabelle (salato / dolce) e due viste (indice / dettaglio).
// ═══════════════════════════════════════════════════════════════

const CATEGORIE = {
  salato: ['Sfiziosità', 'Primi Piatti', 'Secondi Piatti', 'Piatti unici', 'Insalatone', 'Panini', 'Contorni', 'Pane e Lievitati', 'Salsine', 'Bevande'],
  dolce:  ['Torte', 'Biscotti', 'Creme e basi', 'Vario', 'Bevande']
};
const TABELLA = { salato: 'ricette_salate', dolce: 'ricette_dolci' };
const TOOLS = [
  { k: 'forno',      label: 'Forno' },
  { k: 'frigo',      label: 'Frigo' },
  { k: 'pentola',    label: 'Pentola' },
  { k: 'padella',    label: 'Padella' },
  { k: 'frullatore', label: 'Frullatore' }
];

// Sezione STRUMENTAZIONE in fondo alla ricetta. L'ordine qui è quello in cui
// compaiono nella griglia; per aggiungerne uno serve anche l'immagine
// assets/st-<chiave>.png (vedi tools/mkstrumenti.py).
// L'ordine è quello della griglia, quattro per riga.
const STRUMENTI = [
  // preparazione
  { k: 'coltello',     label: 'Coltello' },
  { k: 'tagliere',     label: 'Tagliere' },
  { k: 'ciotola',      label: 'Ciotola' },
  { k: 'bilancia',     label: 'Bilancia' },
  // taglio e riduzione
  { k: 'pelapatate',   label: 'Pelapatate' },
  { k: 'mandolina',    label: 'Mandolina' },
  { k: 'grattugia',    label: 'Grattugia' },
  { k: 'spremiagrumi', label: 'Spremiagrumi' },
  // filtrare e spalmare
  { k: 'scolapasta',   label: 'Scolapasta' },
  { k: 'setaccio',     label: 'Setaccio' },
  { k: 'spatola',      label: 'Spatola' },
  { k: 'pennello',     label: 'Pennello' },
  // montare e frullare
  { k: 'frusta',       label: 'Frusta' },
  { k: 'sbattitore',   label: 'Sbattitore' },
  { k: 'planetaria',   label: 'Planetaria' },
  { k: 'minipimer',    label: 'Minipimer' },
  // dolci e forno
  { k: 'mattarello',   label: 'Mattarello' },
  { k: 'sacapoche',    label: 'Sac à poche' },
  { k: 'teglia',       label: 'Teglia' },
  { k: 'tortiera',     label: 'Tortiera' },
  // apparecchi
  { k: 'tostapane',    label: 'Tostapane' },
  { k: 'microonde',    label: 'Microonde' },
  { k: 'schiacciapatate', label: 'Schiacciapatate' },
  { k: 'termometro',   label: 'Termometro' }
];

// Il link "Vai alla ricetta" apre Safari invece di restare dentro l'app
// installata. Metti false per tornare al comportamento standard.
const FORZA_SAFARI = true;

// ── STATO ────────────────────────────────────────────────────────
let session = JSON.parse(localStorage.getItem('ric_session') || 'null');
let data    = JSON.parse(localStorage.getItem('ric_cache') || '{"salato":[],"dolce":[]}');
let vista   = 'salato';          // vista corrente dell'indice
let corrente = null;             // ricetta aperta (oggetto, anche non salvata)
let inModifica = false;          // dettaglio in modalità editabile
let totalManuale = false;        // l'utente ha scritto a mano il tempo totale

const $ = id => document.getElementById(id);

function saveCache() { localStorage.setItem('ric_cache', JSON.stringify(data)); }
function setDot(s)   { $('dot').className = 'dot' + (s ? ' ' + s : ''); }

let toastTimer = null;
function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast' + (isErr ? ' err' : ''); }, 2600);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Testo ripulito dai caratteri che Postgres non accetta in una colonna text
// (NUL e controlli) e dai surrogati spaiati: senza questo un copia-incolla
// "sporco" farebbe fallire il salvataggio.
function pulisci(s) {
  if (typeof s !== 'string' || !s) return s || '';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) continue;
    if (c >= 0x7f && c <= 0x9f) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) { out += s[i] + s[i + 1]; i++; }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    out += s[i];
  }
  return out;
}

// ═══ AUTENTICAZIONE ══════════════════════════════════════════════
$('tab-login').onclick  = () => switchTab('login');
$('tab-signup').onclick = () => switchTab('signup');
function switchTab(t) {
  $('tab-login').classList.toggle('on', t === 'login');
  $('tab-signup').classList.toggle('on', t === 'signup');
  $('form-login').style.display  = t === 'login'  ? 'block' : 'none';
  $('form-signup').style.display = t === 'signup' ? 'block' : 'none';
}

$('btn-login').onclick = async () => {
  const email = $('li-email').value.trim(), pw = $('li-pw').value;
  const msg = $('li-msg'), btn = $('btn-login');
  msg.className = 'msg err';
  if (!email || !pw) { msg.textContent = 'Inserisci email e password.'; return; }
  btn.disabled = true; btn.textContent = 'ACCESSO…'; msg.textContent = '';
  try {
    const res = await sb.signIn(email, pw);
    if (res.error || !res.access_token) throw new Error((res.error && res.error.message) || res.error_description || 'Credenziali non valide.');
    session = {
      token: res.access_token, refreshToken: res.refresh_token,
      userId: res.user.id, email: res.user.email,
      expiresAt: scadenza(res)
    };
    localStorage.setItem('ric_session', JSON.stringify(session));
    await avvia();
  } catch (e) {
    msg.textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'ACCEDI';
  }
};

$('btn-signup').onclick = async () => {
  const email = $('su-email').value.trim(), pw = $('su-pw').value;
  const msg = $('su-msg'), btn = $('btn-signup');
  msg.className = 'msg err';
  if (!email || !pw) { msg.textContent = 'Inserisci email e password.'; return; }
  if (pw.length < 6) { msg.textContent = 'La password deve avere almeno 6 caratteri.'; return; }
  btn.disabled = true; btn.textContent = 'ATTENDI…'; msg.textContent = '';
  try {
    const res = await sb.signUp(email, pw);
    if (res.error) throw new Error(res.error.message || 'Registrazione non riuscita.');
    msg.className = 'msg ok';
    msg.textContent = 'Account creato. Conferma dalla mail ricevuta, poi accedi.';
  } catch (e) {
    msg.textContent = e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'CREA ACCOUNT';
  }
};

$('btn-logout').onclick = async () => {
  if (!confirm('Vuoi uscire dall\'account?')) return;
  if (session) await sb.signOut(session.token).catch(() => {});
  session = null;
  localStorage.removeItem('ric_session');
  localStorage.removeItem('ric_cache');
  data = { salato: [], dolce: [] };
  $('scr-index').classList.remove('on');
  $('scr-recipe').classList.remove('on');
  $('auth').style.display = 'flex';
  $('li-pw').value = '';
  switchTab('login');
};

// ── avvio / auto-login ───────────────────────────────────────────
async function avvia() {
  $('auth').style.display = 'none';
  mostraIndice();
  await ricarica(true);
  setInterval(rinnovaToken, 45 * 60 * 1000);
  setInterval(() => {
    if (document.visibilityState === 'visible' && !inModifica) controllaNovita();
  }, 30000);
}

// Prima il controllo periodico riscaricava ogni volta tutte le ricette di
// entrambe le tabelle, contenuto compreso: decine di KB ogni trenta secondi,
// che sul telefono rubano banda al salvataggio. Ora chiede solo id e
// updated_at (poche centinaia di byte) e scarica davvero solo se è cambiato
// qualcosa.
let firmaDati = '';
function firma(righe) {
  return righe.map(r => r.id + ':' + (r.updated_at || '')).sort().join('|');
}

async function controllaNovita() {
  if (!session) return;
  try {
    await assicuraToken();
    const [sal, dol] = await Promise.all([
      sb.listVersions(session.token, TABELLA.salato),
      sb.listVersions(session.token, TABELLA.dolce)
    ]);
    const f = firma(sal) + '#' + firma(dol);
    if (f !== firmaDati) {
      firmaDati = f;
      await ricarica(false);
    }
  } catch (e) { /* silenzioso: è un controllo di sottofondo */ }
}

// Quando scade il token, in secondi epoch. Supabase manda expires_at, ma se
// mancasse lo ricaviamo da expires_in (di norma un'ora).
function scadenza(res) {
  return res.expires_at || (Math.floor(Date.now() / 1000) + (res.expires_in || 3600));
}

async function rinnovaToken() {
  if (!session || !session.refreshToken) return false;
  try {
    const d = await sb.refresh(session.refreshToken);
    if (!d.access_token) return false;
    session.token = d.access_token;
    if (d.refresh_token) session.refreshToken = d.refresh_token;
    session.expiresAt = scadenza(d);
    localStorage.setItem('ric_session', JSON.stringify(session));
    return true;
  } catch (e) { return false; }
}

// Rinnova PRIMA di usare il token, non dopo che la richiesta è già fallita.
// Era questa la lentezza: con il token scaduto ogni salvataggio pagava tre
// viaggi di rete (tentativo fallito → rinnovo → nuovo tentativo) invece di uno.
// `expiresAt` manca nelle sessioni salvate dalla versione precedente: in quel
// caso rinnoviamo una volta e da lì in poi la scadenza c'è.
async function assicuraToken() {
  if (!session) return false;
  const ora = Math.floor(Date.now() / 1000);
  if (!session.expiresAt || session.expiresAt - ora < 120) return rinnovaToken();
  return true;
}

// Carica entrambe le tabelle. `mostraErrori` evita rumore nei refresh silenziosi.
async function ricarica(mostraErrori) {
  if (!session) return;
  if (mostraErrori !== 'retry') await assicuraToken();
  setDot('sync');
  try {
    const [sal, dol] = await Promise.all([
      sb.listRecipes(session.token, TABELLA.salato),
      sb.listRecipes(session.token, TABELLA.dolce)
    ]);
    data = { salato: sal, dolce: dol };
    firmaDati = firma(sal) + '#' + firma(dol);
    saveCache();
    setDot('ok');
    if ($('scr-index').classList.contains('on')) renderIndice();
  } catch (e) {
    // Token scaduto: prova a rinnovarlo una volta sola e riprova.
    if (mostraErrori !== 'retry' && await rinnovaToken()) return ricarica('retry');
    setDot('err');
    if (mostraErrori) toast('Non riesco a leggere le ricette dal cloud.', true);
  }
}

(async () => {
  if (session && session.token) {
    await rinnovaToken();
    await avvia();
  } else {
    $('auth').style.display = 'flex';
  }
})();

// ═══ INDICE ══════════════════════════════════════════════════════
function mostraIndice() {
  $('scr-recipe').classList.remove('on');
  $('scr-links').classList.remove('on');
  $('scr-index').classList.add('on');
  // accende la fascia illustrata nello sfondo a sfioramento (solo sull'indice)
  document.body.classList.add('su-indice');
  corrente = null; inModifica = false;
  renderIndice();
}

function applicaTema() {
  const dolce = vista === 'dolce';
  // anche su <html>: è lì che sta lo sfondo della tela del documento
  document.documentElement.classList.toggle('dolce', dolce);
  document.body.classList.toggle('dolce', dolce);
  $('idx-title').textContent = vista === 'salato' ? 'RICETTE SALATE' : 'RICETTE DOLCI';
  $('btn-switch').textContent = vista === 'salato' ? 'DOLCI ›' : '‹ SALATE';
  // "DA PROVARE" apre una lista condivisa fra tutte le viste: il pulsante
  // sta solo sulla landing (Salate), come richiesto, ma i link non sono
  // divisi per vista.
  $('btn-links').style.display = vista === 'salato' ? '' : 'none';
}

// Categorie da mostrare: quelle previste, più eventuali categorie "orfane"
// presenti nei dati (es. dopo una rinomina) così nessuna ricetta scompare.
function categorieVista() {
  const cats = CATEGORIE[vista].slice();
  (data[vista] || []).forEach(r => { if (r.categoria && !cats.includes(r.categoria)) cats.push(r.categoria); });
  return cats;
}

// Ricette di una categoria, in ordine alfabetico. `sensitivity: 'base'` rende
// il confronto indifferente ad accenti e maiuscole, così "Èclair" e "eclair"
// finiscono dove ci si aspetta; `numeric` ordina "Torta 2" dopo "Torta 10".
function perCategoria(cat) {
  return (data[vista] || [])
    .filter(r => r.categoria === cat)
    .sort((a, b) => String(a.titolo || '').localeCompare(
      String(b.titolo || ''), 'it', { sensitivity: 'base', numeric: true }));
}

// Ordine di sfogliamento = ordine con cui compaiono nell'indice.
function ordineIndice() {
  const out = [];
  categorieVista().forEach(c => perCategoria(c).forEach(r => out.push(String(r.id))));
  return out;
}

function renderIndice() {
  applicaTema();
  const list = $('idx-list');
  list.innerHTML = categorieVista().map(cat => {
    const righe = perCategoria(cat);
    return '<div class="cat" data-cat="' + esc(cat) + '">' +
      '<div class="cat-name">' + esc(cat) + '</div>' +
      righe.map(r => '<div class="row" data-id="' + esc(r.id) + '">' + esc(r.titolo) + '</div>').join('') +
      '</div>';
  }).join('');
  list.querySelectorAll('.row').forEach(el => {
    el.onclick = () => apriRicetta(el.dataset.id);
  });
  cerca();
}

$('btn-switch').onclick = () => {
  vista = vista === 'salato' ? 'dolce' : 'salato';
  $('q').value = ''; $('searchbar').classList.remove('filled');
  $('idx-scroll').scrollTop = 0;
  renderIndice();
};

// ── RICERCA "SMART" ──────────────────────────────────────────────
// Non serve scrivere il titolo intero: prova, in ordine di qualità,
// corrispondenza esatta → inizio titolo → inizio di una parola →
// sottostringa → tutte le parole cercate presenti → lettere in sequenza.
// accenti via decomposizione Unicode: "però" → "pero", "Sfizietà" → "sfizieta"
const DIACRITICI = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(DIACRITICI, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function punteggio(titolo, q) {
  const t = norm(titolo), n = norm(q);
  if (!n) return 0;
  if (t === n) return 1000;
  if (t.startsWith(n)) return 900 - (t.length - n.length) * 0.1;
  const parole = t.split(' ');
  if (parole.some(p => p.startsWith(n))) return 800 - t.length * 0.1;
  const idx = t.indexOf(n);
  if (idx >= 0) return 700 - idx;
  const tok = n.split(' ').filter(Boolean);
  if (tok.length > 1 && tok.every(x => parole.some(p => p.startsWith(x)))) return 600;
  if (tok.length > 1 && tok.every(x => t.includes(x))) return 500;
  // sottosequenza: le lettere cercate compaiono in ordine nel titolo
  const flatT = t.replace(/ /g, ''), flatN = n.replace(/ /g, '');
  let i = 0, salti = 0, ultimo = -1;
  for (let j = 0; j < flatT.length && i < flatN.length; j++) {
    if (flatT[j] === flatN[i]) { if (ultimo >= 0 && j !== ultimo + 1) salti++; ultimo = j; i++; }
  }
  if (i === flatN.length && flatN.length >= 2) return Math.max(50, 300 - salti * 12);
  return 0;
}

function cerca() {
  const q = $('q').value.trim();
  $('searchbar').classList.toggle('filled', q.length > 0);
  const righe = Array.from(document.querySelectorAll('#idx-list .row'));
  righe.forEach(el => el.classList.remove('hit', 'hit-top', 'dim'));
  document.querySelectorAll('#idx-list .cat').forEach(el => el.classList.remove('dim-all'));
  document.querySelectorAll('.no-hit').forEach(el => el.remove());
  if (!q) return;

  const byId = {};
  (data[vista] || []).forEach(r => { byId[r.id] = r; });
  let migliore = null, maxP = 0;
  righe.forEach(el => {
    const r = byId[el.dataset.id];
    const p = r ? punteggio(r.titolo, q) : 0;
    if (p > 0) {
      el.classList.add('hit');
      if (p > maxP) { maxP = p; migliore = el; }
    } else {
      el.classList.add('dim');
    }
  });

  if (!migliore) {
    document.querySelectorAll('#idx-list .cat').forEach(el => el.classList.add('dim-all'));
    const n = document.createElement('div');
    n.className = 'no-hit';
    n.textContent = 'Nessuna ricetta trovata.';
    $('idx-list').prepend(n);
    return;
  }
  migliore.classList.add('hit-top');
}

// Mentre si digita si evidenzia soltanto; è la lente (o Invio) a spostare
// la pagina sulla riga trovata, così la lista non "salta" sotto le dita.
function vaiAlRisultato() {
  const top = document.querySelector('#idx-list .row.hit-top');
  if (!top) {
    if ($('q').value.trim()) toast('Nessuna ricetta trovata.', true);
    return;
  }
  $('q').blur();
  // Posizione calcolata a mano invece di scrollIntoView: dentro un contenitore
  // scrollabile è più prevedibile, e possiamo tenere la riga poco sopra il centro.
  const sc = $('idx-scroll');
  const target = Math.max(0, Math.min(top.offsetTop - sc.clientHeight * 0.38,
                                      sc.scrollHeight - sc.clientHeight));
  if (sc.scrollTo) {
    sc.scrollTo({ top: target, behavior: 'smooth' });
    // rete di sicurezza: se lo scorrimento morbido non parte (o non è
    // supportato) ci arriviamo comunque, senza animazione.
    setTimeout(() => { if (Math.abs(sc.scrollTop - target) > 4) sc.scrollTop = target; }, 450);
  } else {
    sc.scrollTop = target;
  }
  top.classList.remove('flash');
  void top.offsetWidth;
  top.classList.add('flash');
}

$('q').addEventListener('input', cerca);
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); vaiAlRisultato(); } });
$('q').addEventListener('search', vaiAlRisultato);
$('q-go').onclick = vaiAlRisultato;
$('q-clear').onclick = () => { $('q').value = ''; cerca(); $('q').focus(); };

// ═══ DETTAGLIO RICETTA ═══════════════════════════════════════════
function vuota() {
  return {
    id: null, categoria: CATEGORIE[vista][0], titolo: '', link: '', dosi: '', autore: '',
    prep_time: '', cook_time: '', total_time: '',
    tools: {}, ingredienti: '', procedimento: ['', '', '', '', ''], strumenti: [], note: ''
  };
}

// Restituisce un indirizzo utilizzabile, oppure '' se il campo link è vuoto
// (o contiene solo spazi): in quel caso il pulsante "Vai alla ricetta" non
// viene proprio creato. Se manca lo schema lo aggiunge, altrimenti il browser
// interpreterebbe "giallozafferano.it/..." come percorso interno all'app.
function urlValido(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(javascript|data|vbscript):/i.test(s)) return '';   // niente schemi pericolosi
  if (/^\/\//.test(s)) return 'https:' + s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s)) return 'https://' + s;
  return '';
}

// Un passo si colora di rosso se cita uno strumento "caldo o freddo".
// STRUMENTO_NOME: parole intere. STRUMENTO_VERBO: verbi che implicano lo
// strumento ("inforna", "frulla", "congelare"). Togli la seconda regex se
// preferisci che valgano solo i sostantivi esatti.
// Radici invece di elenchi chiusi, così i diminutivi sono coperti da soli:
// pentol- prende pentola/pentole/pentolino/pentolina/pentolini,
// padell- prende padella/padelle/padellino/padellina/padelline.
const STRUMENTO_NOME = new RegExp('(^| )(' + [
  'forno', 'forni', 'fornell[oi]',
  'frigo', 'frigorifer[oi]', 'freezer', 'congelator[ei]', 'abbattitore',
  'pentol[aeio]\\w*', 'padell[aeio]\\w*', 'casseruol[ae]', 'tegam[ei]\\w*',
  'frullator[ei]', 'mixer', 'minipimer', 'planetaria', 'microonde'
].join('|') + ')( |$)');
// Radici di verbi: il confronto è per prefisso, quindi "cuoc" copre da solo
// cuoci, cuoce, cuocere, cuociono, cuocete. Coprono la cottura in generale,
// non solo lo strumento.
const STRUMENTO_VERBO = new RegExp('(^| )(' + [
  // cuocere e cucinare
  'cuoc', 'cucin', 'cottur',
  // forno
  'inforn', 'sforn', 'gratin', 'arrost',
  // fuoco vivo
  'frigg', 'fritt', 'soffrigg', 'soffritt', 'rosol', 'salt', 'scott', 'grigli', 'tost', 'bras',
  // acqua e vapore
  'boll', 'less', 'sbollent', 'vapor', 'stuf',
  // calore in generale
  'scald', 'riscald', 'fiamm', 'fuoc',
  // freddo. Non "raffredd": far raffreddare sul tavolo non è né cottura né
  // strumento, e "raffreddare in frigo" si accende già grazie a "frigo".
  'congel', 'surgel', 'refriger',
  // frullare
  'frull'
].join('|') + ')');
// "carta forno" non vuol dire infornare: la si toglie prima di cercare.
const FALSI_AMICI = /(^| )carta (da |del )?forno( |$)/g;

function passoCaldo(testo) {
  const t = norm(testo).replace(FALSI_AMICI, ' ');
  return STRUMENTO_NOME.test(t) || STRUMENTO_VERBO.test(t);
}

// "https://…" diventa "x-safari-https://…" solo quando l'app gira installata
// sulla Home: così iOS apre una scheda in Safari invece di restare dentro
// l'app. In Safari normale e sul computer il link resta quello vero.
function hrefApribile(u) {
  if (!u || !FORZA_SAFARI || !window.navigator.standalone) return u;
  return u.replace(/^http(s?):\/\//i, 'x-safari-http$1://');
}

// Nome da mostrare come autore quando il campo è lasciato vuoto: lo ricaviamo
// dall'email di chi sta salvando. L'email degli ALTRI utenti non è leggibile
// dall'app (la tabella auth.users non è esposta), quindi l'attribuzione si può
// registrare solo al momento del salvataggio.
const AUTORE_DI_RISERVA = 'Chiara e Ale';
function autoreDaSessione() {
  const email = (session && session.email) || '';
  const parti = email.split('@')[0].split(/[._\-+]+/).filter(Boolean);
  const nome = parti.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  return nome || AUTORE_DI_RISERVA;
}

function dataItaliana(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

$('btn-new').onclick = () => {
  corrente = vuota();
  inModifica = true;
  totalManuale = false;
  mostraRicetta();
};

function apriRicetta(id) {
  const r = (data[vista] || []).find(x => String(x.id) === String(id));
  if (!r) return;
  corrente = JSON.parse(JSON.stringify(r));
  if (!Array.isArray(corrente.procedimento)) corrente.procedimento = [];
  if (!Array.isArray(corrente.strumenti)) corrente.strumenti = [];
  if (!corrente.tools || typeof corrente.tools !== 'object') corrente.tools = {};
  inModifica = false;
  // Il totale continua ad aggiornarsi da solo finché combacia con prep+cook:
  // se in passato è stato scritto a mano un valore diverso, lo rispettiamo.
  totalManuale = !!corrente.total_time &&
    minuti(corrente.total_time) !== (minuti(corrente.prep_time) || 0) + (minuti(corrente.cook_time) || 0);
  mostraRicetta();
}

$('btn-back').onclick = () => {
  if (inModifica && !confirm('Uscire senza salvare le modifiche?')) return;
  mostraIndice();
};

function mostraRicetta(verso) {
  $('scr-index').classList.remove('on');
  $('scr-recipe').classList.add('on');
  document.body.classList.remove('su-indice');   // niente fascia nella ricetta
  $('rec-scroll').scrollTop = 0;
  renderAzioni();
  renderRicetta();
  renderFrecce();
  if (verso) {
    const el = $('rec-scroll');
    el.classList.remove('pg-l', 'pg-r');
    void el.offsetWidth;                       // forza il restart dell'animazione
    el.classList.add(verso > 0 ? 'pg-r' : 'pg-l');
  }
}

// ── sfogliare le ricette come le pagine di un libro ──────────────
// Swipe orizzontale oppure le due frecce flottanti negli angoli in basso.
function renderFrecce() {
  const box = $('pg-arrows');
  const ord = ordineIndice();
  const i = corrente && corrente.id ? ord.indexOf(String(corrente.id)) : -1;
  // niente frecce in modifica, su una ricetta non salvata o se è l'unica
  const attive = !inModifica && i >= 0 && ord.length > 1;
  box.classList.toggle('on', attive);
  if (!attive) return;
  $('pg-prev').disabled = i === 0;
  $('pg-next').disabled = i === ord.length - 1;
}

$('pg-prev').onclick = () => sfoglia(-1);
$('pg-next').onclick = () => sfoglia(1);

// verso: +1 = ricetta successiva, -1 = precedente
function sfoglia(verso) {
  if (inModifica || !corrente || !corrente.id) return;
  const ord = ordineIndice();
  const i = ord.indexOf(String(corrente.id));
  const j = i + verso;
  if (i < 0 || j < 0 || j >= ord.length) return;
  const r = (data[vista] || []).find(x => String(x.id) === ord[j]);
  if (!r) return;
  corrente = JSON.parse(JSON.stringify(r));
  if (!Array.isArray(corrente.procedimento)) corrente.procedimento = [];
  if (!Array.isArray(corrente.strumenti)) corrente.strumenti = [];
  if (!corrente.tools || typeof corrente.tools !== 'object') corrente.tools = {};
  totalManuale = !!corrente.total_time &&
    minuti(corrente.total_time) !== (minuti(corrente.prep_time) || 0) + (minuti(corrente.cook_time) || 0);
  mostraRicetta(verso);
}

// Swipe orizzontale: parte solo se il movimento è chiaramente laterale,
// così non ruba lo scroll verticale della ricetta.
(() => {
  const area = $('rec-scroll');
  let x0 = 0, y0 = 0, valido = false;
  area.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { valido = false; return; }
    valido = !inModifica;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener('touchend', e => {
    if (!valido || inModifica) return;
    valido = false;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    sfoglia(dx < 0 ? 1 : -1);
  }, { passive: true });

  // equivalente col mouse, per provare da computer
  let mx = 0, giu = false;
  area.addEventListener('mousedown', e => {
    if (inModifica || e.target.closest('a,input,textarea,button,select')) { giu = false; return; }
    giu = true; mx = e.clientX;
  });
  area.addEventListener('mouseup', e => {
    if (!giu) return;
    giu = false;
    const dx = e.clientX - mx;
    if (Math.abs(dx) > 55) sfoglia(dx < 0 ? 1 : -1);
  });
})();

function renderAzioni() {
  const box = $('rec-actions');
  box.innerHTML = inModifica
    ? '<button class="pill" id="a-annulla">ANNULLA</button><button class="pill solid" id="a-salva">SALVA</button>'
    : '<button class="pill" id="a-condividi" title="Condividi come PDF">PDF</button>' +
      '<button class="pill" id="a-modifica">MODIFICA</button>';
  if (inModifica) {
    $('a-annulla').onclick = () => {
      if (!confirm('Annullare le modifiche?')) return;
      if (corrente.id) { apriRicetta(corrente.id); } else { mostraIndice(); }
    };
    $('a-salva').onclick = salva;
  } else {
    $('a-modifica').onclick = () => { inModifica = true; renderAzioni(); renderRicetta(); renderFrecce(); };
    $('a-condividi').onclick = condividiRicettaPDF;
  }
}

// Condivide la SINGOLA ricetta come PDF, con i colori e i caratteri dell'app
// ma impaginata per il foglio: una scheda a larghezza piena (184mm, la zona
// stampabile di A4), con Ingredienti e Procedimento AFFIANCATI in due
// colonne — non la schermata del telefono impilata in colonna unica, che
// misurata usciva 270mm contro 269 disponibili e sforava di un soffio su
// una seconda pagina. Le due colonne fanno sì che l'altezza finale sia
// quella della colonna più alta, non la somma delle due.
// Le icone e le cifre sono <img> già colorati (assets/p-*.png): a schermo
// sono maschere CSS colorate dal foglio di stile, ma Safari non applica le
// maschere in stampa e restavano rettangoli pieni di colore. Un <img> è
// contenuto, non decorazione, e viene sempre stampato.
function componiRicettaSingola(r) {
  const h = [];
  const img = (file, alt, cls) =>
    '<img src="assets/' + file + '" alt="' + esc(alt) + '"' + (cls ? ' class="' + cls + '"' : '') + ' />';

  h.push('<div class="sr-tit">' + esc(r.titolo || 'Senza titolo') + '</div>');
  h.push('<div class="sr-rig"></div>');
  // categoria e dosi sulla stessa riga: una riga di altezza risparmiata,
  // che nella colonna unica di prima si somma solo verso il basso
  if (r.categoria || r.dosi) {
    h.push('<div class="sr-meta1">' +
      (r.categoria ? '<span class="sr-catlbl">' + esc(r.categoria) + '</span>' : '') +
      (r.dosi ? '<b>Dosi:</b> ' + esc(r.dosi) : '') + '</div>');
  }

  // i tre tempi, negli ovali come nell'app
  h.push('<div class="sr-tempi">' + [
    ['Prep<br/>time:', r.prep_time], ['Cook<br/>time:', r.cook_time], ['Total<br/>time:', r.total_time]
  ].map(([et, v]) =>
    '<div class="sr-tempo"><div class="et">' + et + '</div>' +
    '<div class="ov">' + (v ? esc(v) : '&nbsp;') + '</div></div>'
  ).join('') + '</div>');

  // le cinque icone in cima: rosse se attive (con la nota sotto), altrimenti
  // color inchiostro e un po' trasparenti, come a schermo
  h.push('<div class="sr-tools">' + TOOLS.map(t => {
    const attivo = r.tools && Object.prototype.hasOwnProperty.call(r.tools, t.k);
    const nota = attivo ? String(r.tools[t.k] || '').trim() : '';
    return '<div class="sr-tool' + (attivo ? '' : ' spento') + '">' +
      img('p-ic-' + t.k + '-' + (attivo ? 'red' : 'ink') + '.png', t.label) +
      (nota ? '<div class="nota">' + esc(nota) + '</div>' : '') + '</div>';
  }).join('') + '</div>');

  // Ingredienti e Procedimento affiancati in due colonne, non in colonna
  // unica: è questo lo scarto di altezza che serve a stare in una pagina —
  // l'altezza finale è quella della colonna più alta, non la somma delle due.
  const ingr = String(r.ingredienti || '').split('\n').map(x => x.trim()).filter(Boolean);
  const passi = (Array.isArray(r.procedimento) ? r.procedimento : [])
    .map(x => String(x || '').trim()).filter(Boolean);

  h.push('<div class="sr-due">');
  h.push('<div class="sr-col-ingr"><div class="sr-sez">INGREDIENTI:</div>' + (ingr.length
    ? '<ul class="sr-ingr">' + ingr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
    : '<div class="sr-vuoto">non indicati</div>') + '</div>');

  h.push('<div class="sr-col-proc"><div class="sr-sez">PROCEDIMENTO:</div>' + (!passi.length
    ? '<div class="sr-vuoto">non indicato</div>'
    : passi.map((p, i) => {
        const n = i + 1;
        const tinta = passoCaldo(p) ? 'red' : 'ink';
        const cifre = String(n).split('')
          .map(c => img('p-num' + c + '-' + tinta + '.png', c)).join('');
        return '<div class="sr-passo">' + cifre + '<div class="txt">' + esc(p) + '</div></div>';
      }).join('')) + '</div>');
  h.push('</div>');

  const scelti = Array.isArray(r.strumenti) ? r.strumenti : [];
  const usati = STRUMENTI.filter(s => scelti.includes(s.k));
  if (usati.length) {
    h.push('<div class="sr-sez" style="margin-top:4mm">STRUMENTAZIONE:</div>');
    h.push('<div class="sr-strum">' + usati.map(s =>
      '<div class="voce">' + img('p-st-' + s.k + '-red.png', s.label) +
      '<div class="et">' + esc(s.label) + '</div></div>'
    ).join('') + '</div>');
  }

  if (r.note) {
    h.push('<div class="sr-sez">NOTE:</div>');
    h.push('<div class="sr-note">' + esc(r.note) + '</div>');
  }

  // Link vero e cliccabile nel PDF: mai la riscrittura x-safari-, che in un
  // PDF sarebbe uno schema che nessun lettore sa aprire. L'indirizzo è anche
  // scritto per esteso, così resta utile su carta.
  const href = urlValido(r.link);
  if (href) {
    h.push('<div class="sr-link">Ricetta originale: ' +
      '<a href="' + esc(href) + '">' + esc(href) + '</a></div>');
  }

  const firma = [];
  if (r.autore) firma.push('Aggiunta da ' + r.autore);
  const quando = dataItaliana(r.created_at);
  if (quando) firma.push(quando);
  h.push('<div class="sr-firma">' + esc(firma.join(' · ') || 'Ricettario') + '</div>');

  return h.join('');
}

function condividiRicettaPDF() {
  if (!corrente) return;
  const box = $('stampa');
  box.className = 'stampa singola';
  box.innerHTML = componiRicettaSingola(corrente);
  toast('Ricetta pronta: tocca l\'anteprima e poi condividi.');
  setTimeout(() => window.print(), 350);
}

function renderRicetta() {
  const r = corrente, ed = inModifica;
  const box = $('rec-scroll');
  const h = [];

  // titolo (in sola lettura il link diventa "Vai alla ricetta" qui accanto)
  if (ed) {
    h.push('<textarea class="rec-title" id="f-titolo" rows="1" placeholder="TITOLO RICETTA">' + esc(r.titolo) + '</textarea>');
  } else {
    const href = hrefApribile(urlValido(r.link));
    h.push('<div class="title-wrap"><div class="rec-title">' + esc(r.titolo || 'SENZA TITOLO') + '</div>' +
      (href ? '<a class="go-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">Vai alla ricetta ↗</a>' : '') +
      '</div>');
  }
  h.push('<div class="rec-rule"></div>');

  // categoria
  if (ed) {
    h.push('<div class="cat-pick"><span class="fld-lbl">Categoria:</span><select id="f-cat">' +
      CATEGORIE[vista].map(c => '<option value="' + esc(c) + '"' + (c === r.categoria ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select></div>');
  } else {
    h.push('<div class="cat-tag">' + esc(r.categoria) + '</div>');
  }

  // dosi / persone
  if (ed) {
    h.push('<div class="fld-row"><span class="fld-lbl">Dosi:</span>' +
      '<input class="line-inp" id="f-dosi" placeholder="es. per 4 persone" value="' + esc(r.dosi || '') + '" /></div>');
  } else if (r.dosi) {
    h.push('<div class="dosi-view"><b>Dosi:</b>' + esc(r.dosi) + '</div>');
  }

  // link: solo in creazione/modifica (in lettura è accanto al titolo)
  if (ed) {
    h.push('<div class="fld-row"><span class="fld-lbl">Link:</span>' +
      '<input class="line-inp" id="f-link" type="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="https://…" value="' + esc(r.link) + '" /></div>');
  }

  // tempi
  const tempo = (id, lbl, val) => '<div class="time-box"><div class="time-lbl">' + lbl + '</div>' +
    '<div class="time-oval"><input id="' + id + '" inputmode="numeric" placeholder="0:00" value="' + esc(val) + '"' +
    (ed ? '' : ' readonly') + ' /></div></div>';
  h.push('<div class="times">' +
    tempo('f-prep',  'Prep<br>time:',  r.prep_time) +
    tempo('f-cook',  'Cook<br>time:',  r.cook_time) +
    tempo('f-total', 'Total<br>time:', r.total_time) + '</div>');

  // strumenti
  h.push('<div class="tools"><div class="tool-icons">' + TOOLS.map(t => {
    const attivo = Object.prototype.hasOwnProperty.call(r.tools || {}, t.k);
    const nota = attivo ? (r.tools[t.k] || '') : '';
    return '<div class="tool' + (attivo ? ' on' : '') + '" data-tool="' + t.k + '" data-locked="' + (ed ? '0' : '1') + '">' +
      '<div class="tool-ic" style="--m:url(assets/ic-' + t.k + '.png)" role="button" aria-label="' + t.label + '"></div>' +
      (ed ? '<input class="tool-note" placeholder="—" value="' + esc(nota) + '" />'
          : '<div class="tool-note view">' + esc(nota) + '</div>') + '</div>';
  }).join('') + '</div></div>');

  // ingredienti
  h.push('<div class="sec-title">INGREDIENTI:</div>');
  if (ed) {
    h.push('<textarea class="ingr-area" id="f-ingr" placeholder="Un ingrediente per riga…">' + esc(r.ingredienti) + '</textarea>');
  } else {
    const righe = String(r.ingredienti || '').split('\n').map(x => x.trim()).filter(Boolean);
    h.push(righe.length
      ? '<ul class="ingr-list">' + righe.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
      : '<div class="empty-note">Nessun ingrediente indicato.</div>');
  }

  // procedimento
  h.push('<div class="sec-title" style="margin-top:22px">PROCEDIMENTO:</div>');
  const passi = ed ? (r.procedimento.length ? r.procedimento : ['', '', '', '', ''])
                   : r.procedimento.map(p => String(p || '').trim()).filter(Boolean);
  if (!ed && !passi.length) {
    h.push('<div class="empty-note">Nessun passo indicato.</div>');
  } else {
    h.push('<div class="steps" id="steps">' + passi.map((p, i) => bloccoPasso(p, i, ed)).join('') + '</div>');
    if (ed) h.push('<button class="btn-step" id="a-passo">+ Aggiungi passo</button>');
  }

  // strumentazione
  // In modifica si vede tutta la griglia e si tocca per selezionare.
  // In lettura si mostrano solo gli strumenti scelti: con sedici icone
  // mostrarle tutte spente sarebbe solo rumore. Se non ce n'è nessuno la
  // sezione non compare affatto.
  const scelti = Array.isArray(r.strumenti) ? r.strumenti : [];
  const daMostrare = ed ? STRUMENTI : STRUMENTI.filter(s => scelti.includes(s.k));
  if (daMostrare.length) {
    h.push('<div class="sec-title" style="margin-top:24px">STRUMENTAZIONE:</div>');
    h.push('<div class="str-grid" id="str-grid">' + daMostrare.map(s => {
      const on = scelti.includes(s.k);
      return '<div class="str' + (ed ? '' : ' str-view') + (on ? ' on' : '') + '" data-str="' + s.k + '"' +
        (ed ? ' role="button"' : '') + '>' +
        '<div class="str-ic" style="--m:url(assets/st-' + s.k + '.png)"></div>' +
        '<div class="str-lbl">' + esc(s.label) + '</div></div>';
    }).join('') + '</div>');
  }

  // note (annotazioni che non sono passaggi)
  if (ed) {
    h.push('<div class="sec-title" style="margin-top:24px">NOTE:</div>');
    h.push('<textarea class="ingr-area" id="f-note" style="min-height:72px" ' +
      'placeholder="Varianti, promemoria, cosa cambiare la prossima volta…">' + esc(r.note || '') + '</textarea>');
  } else if (r.note) {
    h.push('<div class="sec-title" style="margin-top:24px">NOTE:</div>');
    h.push('<div class="note-view">' + esc(r.note) + '</div>');
  }

  // autore
  if (ed) {
    h.push('<div class="fld-row" style="margin-top:22px"><span class="fld-lbl">Autore:</span>' +
      '<input class="line-inp" id="f-autore" placeholder="' + esc(autoreDaSessione() || 'chi l\'ha aggiunta') +
      '" value="' + esc(r.autore || '') + '" /></div>');
  } else if (r.autore || r.created_at) {
    const quando = dataItaliana(r.created_at);
    h.push('<div class="autore-view">' +
      (r.autore ? 'Aggiunta da <b>' + esc(r.autore) + '</b>' : 'Aggiunta') +
      (quando ? ' il ' + esc(quando) : '') + '</div>');
  }

  // elimina
  if (ed && r.id) {
    h.push('<div class="rec-foot"><button class="pill danger" id="a-elimina">ELIMINA RICETTA</button></div>');
  }

  box.innerHTML = h.join('');
  collega(ed);
}

// Ogni cifra è una maschera: assets/num0.png … num9.png. Comporle permette
// qualsiasi numero di passi mantenendo i numeri dipinti del PDF.
function cifreNumero(n) {
  return String(n).split('')
    .map(c => '<span class="cifra" style="--m:url(assets/num' + c + '.png)"></span>').join('');
}
function classeNumero(n, testo) {
  return 'step-num' + (String(n).length > 1 ? ' due' : '') +
    (passoCaldo(testo) ? ' hot' : '');
}

function bloccoPasso(testo, i, ed) {
  const n = i + 1;
  const num = '<div class="' + classeNumero(n, testo) + '">' + cifreNumero(n) + '</div>';
  const corpo = ed
    ? '<textarea class="step-area" rows="2" placeholder="Passo ' + n + '…">' + esc(testo) + '</textarea>' +
      '<div class="step-tools">' +
        '<button type="button" data-az="su" title="Sposta il passo su" aria-label="Sposta su">↑</button>' +
        '<button type="button" data-az="giu" title="Sposta il passo giù" aria-label="Sposta giù">↓</button>' +
        '<button type="button" data-az="sotto" title="Inserisci un passo qui sotto" aria-label="Inserisci sotto">＋</button>' +
        '<button type="button" data-az="canc" class="rosso" title="Elimina il passo" aria-label="Elimina">✕</button>' +
      '</div>'
    : '<div class="step-text">' + esc(testo) + '</div>';
  return '<div class="step">' + num + '<div class="step-body">' + corpo + '</div></div>';
}

// ── formattazione tempi hh:mm ────────────────────────────────────
function mascheraTempo(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 4);
  if (!d) return '';
  if (d.length <= 2) return d;
  return d.slice(0, -2) + ':' + d.slice(-2);
}
function minuti(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [h, m] = s.split(':');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  }
  return parseInt(s.replace(/\D/g, ''), 10) || 0;
}
function daMinuti(n) {
  if (n == null) return '';
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
}
function normalizzaTempo(v) {
  const m = minuti(v);
  return m == null ? '' : daMinuti(m);
}

function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function collega(ed) {
  // textarea che crescono con il contenuto
  $('rec-scroll').querySelectorAll('textarea').forEach(t => {
    autosize(t);
    t.addEventListener('input', () => autosize(t));
  });

  if (!ed) return;

  const prep = $('f-prep'), cook = $('f-cook'), total = $('f-total');
  const aggiornaTotale = () => {
    if (totalManuale) return;
    const a = minuti(prep.value), b = minuti(cook.value);
    total.value = (a == null && b == null) ? '' : daMinuti((a || 0) + (b || 0));
  };
  [prep, cook].forEach(el => {
    el.addEventListener('input', () => { el.value = mascheraTempo(el.value); aggiornaTotale(); });
    el.addEventListener('blur', () => { el.value = normalizzaTempo(el.value); aggiornaTotale(); });
  });
  total.addEventListener('input', () => { totalManuale = true; total.value = mascheraTempo(total.value); });
  total.addEventListener('blur', () => { total.value = normalizzaTempo(total.value); });

  // icone strumenti: click → rossa + riga editabile; ri-click → nera e testo cancellato
  $('rec-scroll').querySelectorAll('.tool').forEach(box => {
    box.querySelector('.tool-ic').onclick = () => {
      const acceso = box.classList.toggle('on');
      const nota = box.querySelector('.tool-note');
      if (acceso) { nota.focus(); } else { nota.value = ''; }
    };
  });

  // strumentazione: tocco per accendere/spegnere
  const grid = $('str-grid');
  if (grid) grid.querySelectorAll('.str').forEach(el => {
    el.onclick = () => el.classList.toggle('on');
  });

  // ── passi ──────────────────────────────────────────────────────
  // Gli ascoltatori stanno sul contenitore, non sui singoli passi: così
  // spostare o inserire un blocco non richiede di ricollegare nulla.
  const steps = $('steps');

  const rinumera = () => {
    const figli = Array.from(steps.children);
    figli.forEach((el, i) => {
      const n = i + 1;
      const num = el.querySelector('.step-num');
      const ta = el.querySelector('.step-area');
      num.className = classeNumero(n, ta ? ta.value : '');
      num.innerHTML = cifreNumero(n);
      if (ta) ta.placeholder = 'Passo ' + n + '…';
      const su = el.querySelector('[data-az="su"]');
      const giu = el.querySelector('[data-az="giu"]');
      if (su) su.disabled = i === 0;
      if (giu) giu.disabled = i === figli.length - 1;
    });
  };

  const nuovoPasso = () => {
    const div = document.createElement('div');
    div.innerHTML = bloccoPasso('', 0, true);
    return div.firstElementChild;
  };

  steps.addEventListener('input', e => {
    const ta = e.target.closest('.step-area');
    if (!ta) return;
    autosize(ta);
    const step = ta.closest('.step');
    step.querySelector('.step-num').classList.toggle('hot', passoCaldo(ta.value));
  });

  steps.addEventListener('click', e => {
    const b = e.target.closest('.step-tools button');
    if (!b) return;
    const step = b.closest('.step');
    const az = b.dataset.az;

    if (az === 'su' && step.previousElementSibling) {
      steps.insertBefore(step, step.previousElementSibling);
    } else if (az === 'giu' && step.nextElementSibling) {
      steps.insertBefore(step.nextElementSibling, step);
    } else if (az === 'sotto') {
      const el = nuovoPasso();
      step.after(el);
      rinumera();
      const ta = el.querySelector('.step-area');
      autosize(ta);
      ta.focus();
      return;
    } else if (az === 'canc') {
      // l'ultimo passo non si elimina: si svuota, così resta una riga su cui scrivere
      if (steps.children.length <= 1) {
        step.querySelector('.step-area').value = '';
        rinumera();
        return;
      }
      step.remove();
    }
    rinumera();
  });

  $('a-passo').onclick = () => {
    const el = nuovoPasso();
    steps.appendChild(el);
    rinumera();
    const ta = el.querySelector('.step-area');
    autosize(ta);
    ta.focus();
  };

  rinumera();          // imposta lo stato iniziale delle frecce

  const del = $('a-elimina');
  if (del) del.onclick = elimina;
}

// ── raccolta dati dal form ───────────────────────────────────────
function leggiForm() {
  const tools = {};
  document.querySelectorAll('#rec-scroll .tool').forEach(box => {
    if (box.classList.contains('on')) tools[box.dataset.tool] = pulisci(box.querySelector('.tool-note').value.trim());
  });
  const passi = Array.from(document.querySelectorAll('#rec-scroll .step-area'))
    .map(t => pulisci(t.value.trim()));
  // via i passi vuoti in coda, ma i buchi in mezzo restano (numerazione stabile)
  while (passi.length && !passi[passi.length - 1]) passi.pop();

  // strumentazione: chiavi accese, nell'ordine canonico di STRUMENTI
  const accesi = new Set(Array.from(document.querySelectorAll('#str-grid .str.on'))
    .map(el => el.dataset.str));
  const strumenti = STRUMENTI.filter(s => accesi.has(s.k)).map(s => s.k);

  return {
    categoria:    $('f-cat').value,
    titolo:       pulisci($('f-titolo').value.trim()),
    link:         pulisci($('f-link').value.trim()),
    dosi:         pulisci($('f-dosi').value.trim()),
    // se lasciato vuoto ci mettiamo il nome ricavato dall'email di chi salva
    autore:       pulisci($('f-autore').value.trim()) || autoreDaSessione(),
    prep_time:    normalizzaTempo($('f-prep').value),
    cook_time:    normalizzaTempo($('f-cook').value),
    total_time:   normalizzaTempo($('f-total').value),
    tools:        tools,
    ingredienti:  pulisci($('f-ingr').value.trim()),
    procedimento: passi,
    strumenti:    strumenti,
    note:         pulisci($('f-note').value.trim())
  };
}

async function salva() {
  const payload = leggiForm();
  if (!payload.titolo) { toast('Serve almeno il titolo della ricetta.', true); $('f-titolo').focus(); return; }

  const btn = $('a-salva');
  btn.disabled = true; btn.textContent = 'SALVO…';
  setDot('sync');
  const tab = TABELLA[vista];

  const esegui = () => corrente.id
    ? sb.updateRecipe(session.token, tab, corrente.id, payload)
    : sb.insertRecipe(session.token, tab, payload);

  try {
    // Rinnovo preventivo: il token si controlla prima, così il caso normale
    // è una sola richiesta.
    await assicuraToken();
    let row;
    try {
      row = await esegui();
    } catch (e) {
      // Riprova SOLO se il token è stato rifiutato. Prima si ritentava su
      // qualsiasi errore, quindi un problema di rete costava tre viaggi
      // prima di dire che non era andata.
      if (e.stato !== 401 || !await rinnovaToken()) throw e;
      row = await esegui();
    }
    const lista = data[vista];
    const i = lista.findIndex(x => String(x.id) === String(row.id));
    if (i >= 0) lista[i] = row; else lista.push(row);
    saveCache();
    setDot('ok');
    corrente = JSON.parse(JSON.stringify(row));
    inModifica = false;
    renderAzioni(); renderRicetta(); renderFrecce();
    toast('Ricetta salvata.');
  } catch (e) {
    setDot('err');
    toast('Salvataggio non riuscito. Controlla la connessione.', true);
    btn.disabled = false; btn.textContent = 'SALVA';
  }
}

async function elimina() {
  if (!corrente.id) return;
  if (!confirm('Eliminare definitivamente «' + corrente.titolo + '»?\nLa ricetta sparirà per tutti.')) return;
  setDot('sync');
  try {
    await sb.deleteRecipe(session.token, TABELLA[vista], corrente.id);
    data[vista] = data[vista].filter(x => String(x.id) !== String(corrente.id));
    saveCache();
    setDot('ok');
    toast('Ricetta eliminata.');
    mostraIndice();
  } catch (e) {
    setDot('err');
    toast('Eliminazione non riuscita.', true);
  }
}

// ═══ RICETTARIO STAMPABILE ═══════════════════════════════════════
// Compone tutte le ricette in una pagina e usa la stampa di sistema: da
// iPhone, Condividi → Stampa → Salva su File dà un PDF leggibile che resta
// tuo anche se il database sparisce. Nessuna libreria esterna.

function tempiLeggibili(r) {
  const p = [];
  if (r.prep_time) p.push('prep ' + r.prep_time);
  if (r.cook_time) p.push('cottura ' + r.cook_time);
  if (r.total_time) p.push('totale ' + r.total_time);
  return p.join(' · ');
}

function strumentiLeggibili(r) {
  const usati = [];
  TOOLS.forEach(t => {
    if (!r.tools || !Object.prototype.hasOwnProperty.call(r.tools, t.k)) return;
    const nota = String(r.tools[t.k] || '').trim();
    usati.push(t.label + (nota ? ' (' + nota + ')' : ''));
  });
  const scelti = Array.isArray(r.strumenti) ? r.strumenti : [];
  STRUMENTI.forEach(s => { if (scelti.includes(s.k)) usati.push(s.label); });
  return usati;
}

function ricettaStampata(r) {
  const h = [];
  h.push('<article class="st-ric"><h4>' + esc(r.titolo || 'Senza titolo') + '</h4>');

  const meta = [];
  if (r.dosi) meta.push('<b>Dosi:</b> ' + esc(r.dosi));
  const t = tempiLeggibili(r);
  if (t) meta.push('<b>Tempi:</b> ' + esc(t));
  if (r.autore) meta.push('<b>Autore:</b> ' + esc(r.autore));
  if (meta.length) h.push('<div class="st-meta">' + meta.join(' &nbsp;·&nbsp; ') + '</div>');

  const link = urlValido(r.link);
  if (link) h.push('<div class="st-link">' + esc(link) + '</div>');

  const strum = strumentiLeggibili(r);
  if (strum.length) {
    h.push('<div class="st-meta"><b>Strumenti:</b> ' + esc(strum.join(', ')) + '</div>');
  }

  const ingr = String(r.ingredienti || '').split('\n').map(x => x.trim()).filter(Boolean);
  const passi = (Array.isArray(r.procedimento) ? r.procedimento : [])
    .map(x => String(x || '').trim()).filter(Boolean);

  h.push('<div class="st-due">');
  h.push('<div><h5>Ingredienti</h5>' + (ingr.length
    ? '<ul>' + ingr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
    : '<div class="st-vuoto">non indicati</div>') + '</div>');
  h.push('<div><h5>Procedimento</h5>' + (passi.length
    ? '<ol>' + passi.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>'
    : '<div class="st-vuoto">non indicato</div>') + '</div>');
  h.push('</div>');

  if (r.note) h.push('<h5>Note</h5><div class="st-note">' + esc(r.note) + '</div>');
  h.push('</article>');
  return h.join('');
}

function componiStampa() {
  const oggi = new Date().toLocaleDateString('it-IT',
    { day: 'numeric', month: 'long', year: 'numeric' });
  const h = ['<div class="st-cop"><h1>RICETTARIO</h1><div class="rig"></div>' +
    '<div class="dt">copia del ' + esc(oggi) + '</div></div>'];

  let totale = 0;
  [['salato', 'RICETTE SALATE'], ['dolce', 'RICETTE DOLCI']].forEach(([v, titolo]) => {
    const ricette = data[v] || [];
    h.push('<h2 class="st-sez">' + titolo + ' &nbsp;<span style="font-size:9pt;color:#6d5c48">(' +
      ricette.length + ')</span></h2>');
    // stesse categorie e stesso ordine alfabetico dell'indice
    const vistaPrima = vista;
    vista = v;
    categorieVista().forEach(cat => {
      const righe = perCategoria(cat);
      if (!righe.length) return;
      h.push('<h3 class="st-cat">' + esc(cat) + '</h3>');
      righe.forEach(r => { h.push(ricettaStampata(r)); totale++; });
    });
    vista = vistaPrima;
  });
  return { html: h.join(''), totale };
}

$('btn-stampa').onclick = async () => {
  const btn = $('btn-stampa');
  btn.disabled = true;
  try {
    // prima riallinea al cloud: il PDF deve valere come copia, non come cache
    await ricarica(true);
    const { html, totale } = componiStampa();
    if (!totale) { toast('Non c\'è ancora nessuna ricetta da stampare.', true); return; }
    // togli la classe `singola`: lo stesso contenitore serve entrambi i PDF
    $('stampa').className = 'stampa';
    $('stampa').innerHTML = html;
    toast(totale + ' ricette pronte: scegli «Salva su File» per il PDF.');
    setTimeout(() => window.print(), 350);
  } catch (e) {
    toast('Non riesco a preparare il ricettario.', true);
  } finally {
    btn.disabled = false;
  }
};

// ═══ LINK DA PROVARE ═════════════════════════════════════════════
// Lista piatta e condivisa, separata dalle ricette vere: un appunto veloce
// prima ancora di trascriverlo come ricetta. Riusa le stesse funzioni
// generiche di supabase.js (list/insert/update/delete su una tabella),
// perché la forma dei dati è semplice — url, nota, created_at — e non
// serve nulla di dedicato.
const TABELLA_LINK = 'link_da_provare';
let links = JSON.parse(localStorage.getItem('ric_links_cache') || '[]');
// Contatore incrementato a ogni modifica locale (aggiunta, rimozione, nota).
// mostraLinks() avvia un aggiornamento dal cloud in sottofondo per essere
// veloce ad aprirsi; senza questa guardia, se nel frattempo aggiungi un
// link il risultato di quell'aggiornamento — partito PRIMA — arriverebbe
// dopo e lo farebbe sparire dalla vista (pur restando salvato sul server).
let linksVersione = 0;

function salvaLinksCache() { localStorage.setItem('ric_links_cache', JSON.stringify(links)); }

function mostraLinks() {
  $('scr-index').classList.remove('on');
  $('scr-recipe').classList.remove('on');
  document.body.classList.remove('su-indice');
  $('scr-links').classList.add('on');
  $('links-scroll').scrollTop = 0;
  renderLinks();
  caricaLinks();
}

async function caricaLinks() {
  if (!session) return;
  const versionePartenza = linksVersione;
  try {
    await assicuraToken();
    const righe = await sb.listRecipes(session.token, TABELLA_LINK);
    // qualcosa è cambiato mentre eravamo in attesa: questo risultato è
    // superato, applicarlo cancellerebbe una modifica locale più recente
    if (linksVersione !== versionePartenza) return;
    // il più recente in cima: più utile per un elenco "da provare" che cresce
    links = righe.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    salvaLinksCache();
    if ($('scr-links').classList.contains('on')) renderLinks();
  } catch (e) { /* silenzioso: la cache locale resta valida */ }
}

function renderLinks() {
  const box = $('links-list');
  if (!links.length) {
    box.innerHTML = '<div class="lk-vuoto">Nessun link in lista. Incollane uno qui sopra.</div>';
    return;
  }
  box.innerHTML = links.map(l => {
    const href = hrefApribile(urlValido(l.url));
    const haNota = !!(l.nota && l.nota.trim());
    return '<div class="lk-row" data-id="' + esc(l.id) + '">' +
      '<div class="lk-top">' +
        '<a class="lk-url" href="' + esc(href || '#') + '" target="_blank" rel="noopener noreferrer">' +
          esc(l.url) + '</a>' +
        '<button class="lk-del" data-az="elimina" title="Rimuovi link" aria-label="Rimuovi link">✕</button>' +
      '</div>' +
      (haNota
        ? '<div class="lk-nota-riga"><div class="lk-nota-testo" data-az="modifica-nota">' + esc(l.nota) + '</div>' +
          '<button class="lk-nota-rm" data-az="rimuovi-nota">rimuovi nota</button></div>'
        : '<button class="lk-nota-add" data-az="aggiungi-nota">+ Nota</button>') +
      '</div>';
  }).join('');
}

function autosizeInline(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// La nota si edita al volo: un tocco sul testo (o su "+ Nota") apre una
// textarea, che salva al blur. Nessun pulsante "salva" a parte: coerente
// con come funzionano già le note delle ricette.
function apriEditorNota(riga, testoIniziale) {
  const id = riga.dataset.id;
  const area = document.createElement('textarea');
  area.className = 'lk-nota-area';
  area.rows = 1;
  area.placeholder = 'Scrivi una nota…';
  area.value = testoIniziale;

  const vecchiaRiga = riga.querySelector('.lk-nota-riga');
  const vecchioBottone = riga.querySelector('.lk-nota-add');
  const contenitore = document.createElement('div');
  contenitore.className = 'lk-nota-riga';
  contenitore.appendChild(area);
  if (vecchiaRiga) riga.replaceChild(contenitore, vecchiaRiga);
  else riga.appendChild(contenitore);

  autosizeInline(area);
  area.addEventListener('input', () => autosizeInline(area));
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);

  area.addEventListener('blur', async () => {
    const testo = pulisci(area.value.trim());
    const link = links.find(l => String(l.id) === String(id));
    if (link) link.nota = testo;
    linksVersione++;
    salvaLinksCache();
    renderLinks();
    try {
      await assicuraToken();
      await sb.updateRecipe(session.token, TABELLA_LINK, id, { nota: testo });
    } catch (e) { toast('Nota non sincronizzata: riprova più tardi.', true); }
  }, { once: true });

  // per pulizia, se avevo appena creato il pulsante "+ Nota" e non serve più
  if (vecchioBottone) vecchioBottone.remove();
}

$('links-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-az]');
  if (!b) return;
  const riga = b.closest('.lk-row');
  const id = riga.dataset.id;
  const link = links.find(l => String(l.id) === String(id));
  if (!link) return;
  const az = b.dataset.az;

  if (az === 'aggiungi-nota') {
    apriEditorNota(riga, '');
  } else if (az === 'modifica-nota') {
    apriEditorNota(riga, link.nota || '');
  } else if (az === 'rimuovi-nota') {
    link.nota = '';
    linksVersione++;
    salvaLinksCache();
    renderLinks();
    try {
      await assicuraToken();
      await sb.updateRecipe(session.token, TABELLA_LINK, id, { nota: '' });
    } catch (err) { toast('Nota non sincronizzata: riprova più tardi.', true); }
  } else if (az === 'elimina') {
    links = links.filter(l => String(l.id) !== String(id));
    linksVersione++;
    salvaLinksCache();
    renderLinks();
    try {
      await assicuraToken();
      await sb.deleteRecipe(session.token, TABELLA_LINK, id);
    } catch (err) {
      toast('Non riesco a rimuoverlo dal cloud: riprova più tardi.', true);
    }
  }
});

async function aggiungiLink() {
  const campo = $('link-url');
  const grezzo = campo.value.trim();
  if (!grezzo) return;
  const url = urlValido(grezzo) || grezzo;   // se non riconosciuto, salva comunque il testo
  const btn = $('link-add');
  btn.disabled = true;
  try {
    await assicuraToken();
    const riga = await sb.insertRecipe(session.token, TABELLA_LINK, { url: pulisci(url), nota: '' });
    links.unshift(riga);
    linksVersione++;
    salvaLinksCache();
    renderLinks();
    campo.value = '';
  } catch (e) {
    toast('Non riesco a salvare il link: controlla la connessione.', true);
  } finally {
    btn.disabled = false;
    campo.focus();
  }
}

$('btn-links').onclick = mostraLinks;
$('btn-links-back').onclick = mostraIndice;
$('link-add').onclick = aggiungiLink;
$('link-url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); aggiungiLink(); } });

// ── rientro dal background (iOS): togli il focus residuo ─────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur();
  if (session && !inModifica) controllaNovita();
});
