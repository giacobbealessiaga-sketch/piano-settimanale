# Ricettario

Ricettario **condiviso**: tutti gli utenti che accedono vedono e modificano le stesse ricette.
Web app statica (niente npm, niente build) pensata per iPhone → *Aggiungi a Home*.

Stesse tecnologie di AgendaBb: **GitHub → Vercel → Supabase**.

---

## 1. Supabase (una volta sola)

L'app punta allo **stesso progetto Supabase di AgendaBb**, quindi gli account esistenti
funzionano già. Per usarne uno diverso, cambia le due costanti in cima a `supabase.js`.

1. Supabase → **SQL Editor** → *New query* → incolla ed esegui tutto il contenuto di
   [`schema.sql`](schema.sql). Crea le tabelle `ricette_salate` e `ricette_dolci` con le
   policy RLS che rendono il ricettario condiviso fra tutti gli utenti autenticati.

   ⚠️ **Se le tabelle esistono già**, non rieseguire `schema.sql`: lancia le migrazioni che
   ti mancano, in ordine.
   - [`migrazione-01.sql`](migrazione-01.sql) — campo *Dosi*, e rinomina la categoria
     *Sfizietà* in *Sfiziosità* sulle ricette già inserite
   - [`migrazione-02.sql`](migrazione-02.sql) — campo *Autore*
   - [`migrazione-03.sql`](migrazione-03.sql) — sezione *Strumentazione*
   - [`migrazione-04.sql`](migrazione-04.sql) — campo *Note*
   - [`migrazione-05.sql`](migrazione-05.sql) — categoria *Dolci* rinominata in *Vario*
   - [`migrazione-06.sql`](migrazione-06.sql) — tabella *Link da provare*
3. **Solo la prima volta**, per caricare le ricette del file Word:
   [`import-ricette.sql`](import-ricette.sql) — 30 ricette, 19 dolci e 11 salate.
   Rieseguirlo è innocuo: ogni ricetta entra solo se non esiste già un titolo uguale.
2. **Consigliato** — Authentication → *Providers* → Email → disattiva **Allow new users to
   sign up**, e crea tu gli account da Authentication → *Users* → *Add user*.
   Senza questo, chiunque conosca l'indirizzo dell'app può registrarsi e scrivere nel
   ricettario: la chiave nel client è pubblica per progetto, la protezione dei dati sta
   tutta nelle policy RLS + in chi riesce ad avere un account.
   (Se disattivi la registrazione, la scheda "Registrati" dell'app risponderà con un errore
   di Supabase: è il comportamento atteso.)

## 2. Pubblicazione

1. Crea un repository GitHub (es. `ricettario`) e caricaci tutti i file di questa cartella,
   **inclusa la cartella `assets/`**.
2. Vercel → *Add New Project* → collega il repo → *Deploy*.
   Nessuna configurazione: è un sito statico, il framework preset è "Other".
3. Da Safari su iPhone: apri l'indirizzo → *Condividi* → **Aggiungi a Home**.

## 3. Sviluppo locale

```bash
python -m http.server 8767 --directory .
```

Poi apri `http://localhost:8767`. (In Claude Code è già configurato come server `ricettario`.)

---

## File

| File | Contenuto |
|---|---|
| `index.html` | markup delle tre schermate (login, indice, ricetta) + tutto il CSS |
| `app.js` | logica: autenticazione, ricerca smart, indice, dettaglio, salvataggio |
| `supabase.js` | client Supabase minimale via `fetch` — **URL e chiave pubblica qui** |
| `schema.sql` | tabelle e policy RLS da eseguire su Supabase (installazione da zero) |
| `migrazione-0*.sql` | aggiornamenti per chi ha già le tabelle |
| `manifest.json` | PWA (icona e avvio a schermo intero) |
| `assets/` | sfondi, illustrazioni, icone e numeri estratti da `Render.pdf` |

Le quattro icone degli strumenti e i numeri 1-5 sono maschere alpha ricavate dai disegni
vettoriali del PDF: il colore arriva da CSS (`background-color` + `mask-image`), per questo
possono diventare rosse. Pentola e padella sono state ispessite per pareggiare il peso del
tratto di forno e frigo. Il **frullatore** non c'era nel PDF: è disegnato da zero nello
stesso stile e con lo stesso spessore.

Gli script che generano tutto stanno in `tools/` (richiedono `pip install pymupdf`) e non
servono all'app: caricali su GitHub solo se ti fa comodo tenerli.

| Script | Cosa rigenera |
|---|---|
| `tools/mkassets.py` | sfondi, fasce decorative, barre di ricerca, numeri, icone PWA |
| `tools/mkicons2.py` | le quattro icone dal PDF, ispessendo pentola e padella |
| `tools/mkfrullatore.py` | l'icona del frullatore (accetta lo spessore del tratto come argomento) |
| `tools/mkstrumenti.py` | le 16 icone della sezione Strumentazione (`assets/st-*.png`) |
| `tools/mkstampa.py` | le varianti già colorate per il PDF (`assets/p-*.png`) |
| `tools/mkcarta.py` | le texture di carta come piastrelle affiancabili |
| `tools/mkicona.py` | le icone dell'app da `icona.png` (scontorno + fondo carta) |
| `tools/mknumeri.py` | le cifre 0, 6, 7, 8, 9 nello stile dipinto del PDF |

Sulle cifre: il PDF contiene solo 1-5, dipinte a pennello asciutto. Le mancanti sono
ricostruite con le metriche misurate sulle originali (tratto ~22 px su 200 px di altezza,
copertura 29-39%) e poi consumate sui bordi con una texture procedurale: striature
verticali nette, profondità del morso modulata da un inviluppo lento perché il contorno
non risulti seghettato in modo regolare. Le originali non vengono toccate.

## Come funziona

**Indice.** Due viste, *Salate* (default all'ingresso) e *Dolci*, con lo switch in basso a
destra. Le categorie sono fisse e sempre visibili, anche se vuote:

- salate → Sfiziosità, Primi Piatti, Secondi Piatti, Piatti unici, Insalatone, Panini,
  Contorni, Pane e Lievitati, Salsine, Bevande
- dolci → Torte, Biscotti, Creme e basi, Vario, Bevande

Dentro ogni categoria le ricette sono in **ordine alfabetico**, indifferente ad accenti e
maiuscole (`localeCompare` con `sensitivity: 'base'`), e con ordinamento numerico naturale
(«Torta 2» prima di «Torta 10»). Ogni voce ha un pallino con rientro sporgente: un titolo
lungo va a capo allineato sotto il proprio testo, così non sembrano due ricette diverse.

L'elenco scorre verticalmente quando le ricette superano l'altezza dello schermo.
Se in futuro una categoria viene rinominata, le ricette rimaste con il vecchio nome
compaiono comunque in fondo all'indice sotto quel nome: non spariscono mai in silenzio.

**Ricerca.** Cerca solo nella tabella della vista corrente. Non serve scrivere il titolo
intero: prova in ordine corrispondenza esatta → inizio titolo → inizio di una parola →
sottostringa → tutte le parole cercate → lettere in sequenza (`mlnzn` trova
*Melanzane alla Parmigiana*).

Mentre digiti le righe che corrispondono si evidenziano e le altre sbiadiscono, ma la
pagina **non si muove**. È il tocco sulla **lente** (o *Invio*) a portare la vista sulla
riga migliore, che si posiziona a un terzo dall'alto e lampeggia due volte. Per aprire la
ricetta si clicca comunque la riga.

**Link da provare.** Il pulsante **DA PROVARE** nella barra in basso — solo sulle Salate,
la vista "di atterraggio" — apre una lista piatta e **condivisa** (stessa RLS delle
ricette), separata da esse: un appunto veloce prima ancora di trascriverlo come ricetta
vera. Non è divisa salato/dolce né per categoria. Si incolla un indirizzo e si tocca
**+ Aggiungi**; sotto ogni link si può aggiungere una nota (un tocco su «+ Nota» apre una
riga di testo, salvata al distacco del focus) e rimuoverla con «rimuovi nota». Quando un
link diventa una ricetta vera, la voce si elimina a mano col tastino ✕: non c'è nessun
collegamento automatico fra le due cose.

Un dettaglio tecnico non ovvio: aprire questa schermata avvia un aggiornamento dal cloud
in sottofondo per essere veloce a comparire. Un contatore di versione (`linksVersione`)
impedisce che, se aggiungi o rimuovi un link mentre quell'aggiornamento è ancora in
transito, il risultato — partito prima e arrivato dopo — sovrascriva la modifica appena
fatta.

**Dettaglio.** Si apre in sola lettura; il pulsante **Modifica** in alto a destra la rende
editabile, con **Salva** / **Annulla** e **Elimina ricetta** in fondo. In alto a sinistra
**← Indice**.

In sola lettura si **sfoglia come un libro**: swipe orizzontale, oppure le due frecce
`‹ ›` flottanti negli angoli in basso. Si passa alla ricetta precedente o successiva
**nell'ordine dell'indice**, con la pagina che entra dal lato da cui arrivi. Agli estremi
la freccia si spegne, e in modifica le frecce scompaiono.

- *Link*: si inserisce in creazione/modifica; in lettura appare accanto al titolo come
  collegamento **Vai alla ricetta ↗**. Quando l'app gira installata sulla Home, l'indirizzo
  viene riscritto in `x-safari-https://` così iOS apre **una scheda in Safari** invece di
  restare dentro l'app; in Safari normale e sul computer il link resta quello vero. Per
  disattivarlo, `FORZA_SAFARI = false` in cima ad `app.js`.
- *Dosi*: testo libero (es. «per 4 persone»), subito sotto la categoria.
- *Strumentazione*: in fondo, una griglia di **24 icone**, sei righe da quattro. In modifica si vedono tutte
  e si toccano per accenderle (rosse); in lettura compaiono **solo quelle scelte**, e se
  non ne hai scelta nessuna la sezione non appare — con ventiquattro icone tutte spente
  sarebbe solo rumore. L'elenco è in `STRUMENTI`, in cima ad `app.js`, ordinato per righe:
  coltello · tagliere · ciotola · bilancia — pelapatate · mandolina · grattugia ·
  spremiagrumi — scolapasta · setaccio · spatola · pennello — frusta · sbattitore ·
  planetaria · minipimer — mattarello · sac à poche · teglia · tortiera — tostapane ·
  microonde · schiacciapatate · termometro.
  Per aggiungerne uno servono una voce in `STRUMENTI` e un `assets/st-<chiave>.png`
  (disegnalo in `tools/mkstrumenti.py`).
- *Autore*: mostrato in fondo alla ricetta come «Aggiunta da **Anna** il 14 agosto 2026»,
  con la data presa da `created_at`. In modifica è un campo libero: se lo lasci vuoto,
  al salvataggio ci finisce il nome ricavato dall'email di chi sta salvando.
  L'email **degli altri** utenti non è leggibile dall'app — la tabella `auth.users` non è
  esposta via API — quindi l'attribuzione si può registrare solo al momento del
  salvataggio, e le ricette inserite prima di questa versione restano senza autore
  finché non le riapri e le salvi.
- *Prep / Cook / Total time*: formato `h:mm`; si digitano solo cifre (`130` → `1:30`).
  Il totale si calcola da solo come prep + cook finché non lo scrivi a mano.
- *Icone forno / frigo / pentola / padella / frullatore*: un tocco le rende rosse e apre la
  riga di testo sotto; un altro tocco le rimette nere e cancella quel testo.
- *Ingredienti*: blocco di testo, un ingrediente per riga → in lettura diventa un elenco.
- *Note*: campo libero in fondo, per varianti e promemoria che non sono passaggi.
  In lettura compare solo se compilato.
- *Procedimento*: un blocco per numero. Sotto ogni passo, in modifica, quattro comandi:
  **↑ ↓** spostano il passo (e quindi il suo testo) di una posizione, **＋** inserisce un
  passo vuoto lì sotto, **✕** lo elimina — l'ultimo rimasto si svuota invece di sparire,
  così resta una riga su cui scrivere. Le frecce si spengono agli estremi. In fondo
  «+ Aggiungi passo» accoda.
  Gli ascoltatori stanno sul contenitore e non sui singoli passi: spostare o inserire un
  blocco non richiede di ricollegare niente.
  I numeri sono **dipinti a pennello**: `num1`-`num5` sono le immagini del PDF,
  `num6`-`num9` e `num0` sono ricostruite nello stesso stile (vedi sotto). Ogni cifra è
  una maschera alpha e il numero viene composto cifra per cifra, quindi funziona a
  qualsiasi numero di passi — dal decimo in poi le cifre si stringono un po'.
  Il numero **diventa rosso** quando il passo parla di cottura o di uno strumento.
  Due elenchi in cima ad `app.js`, entrambi per radice:
  - `STRUMENTO_NOME` — `forno`, `frigo`, `freezer`, `pentola`, `padella`, `frullatore`,
    `planetaria`, `microonde`, `casseruola`, `tegame`. Le radici coprono i diminutivi da
    sole: `pentol-` prende pentolina e pentolino, `padell-` prende padellina e padellino.
  - `STRUMENTO_VERBO` — la cottura in generale: `cuoc-`, `cucin-`, `cottur-`, `inforn-`,
    `sforn-`, `gratin-`, `arrost-`, `frigg-`, `fritt-`, `soffrigg-`, `rosol-`, `salt-`,
    `scott-`, `grigli-`, `tost-`, `bras-`, `boll-`, `less-`, `vapor-`, `stuf-`, `scald-`,
    `fiamm-`, `fuoc-`, `congel-`, `surgel-`, `frull-`.

  Escluse volutamente: **«carta forno»** e «carta da forno» (non si sta infornando), e
  **`raffredd-`** da solo — far raffreddare sul tavolo non è cottura, mentre «raffreddare
  in frigo» si accende comunque grazie a `frigo`. `fornaio` non fa scattare nulla perché
  il confronto è per radice ancorata a inizio parola.

  Se ti accorgi che troppi numeri diventano rossi, il rimedio è togliere righe da
  `STRUMENTO_VERBO`: l'elenco è lì proprio per essere accorciato.
  **«carta forno» è esclusa** — e anche «carta da forno» — perché non si sta infornando;
  ma «metti la carta forno e inforna» resta rossa, perché c'è `inforna`.
  Tutto sta in cima ad `app.js`, in `STRUMENTO_NOME`, `STRUMENTO_VERBO` e `FALSI_AMICI`.

## Copia di sicurezza delle ricette

Le ricette esistono solo su Supabase, quindi conviene tenerne una copia leggibile fuori.

**Dall'app.** Il pulsante **PDF** in alto a sinistra nell'indice, sopra la fascia
illustrata — a destra si sovrapponeva al titolo — riallinea prima i dati al
cloud, poi compone in una pagina tutte le ricette di entrambe le viste — copertina con la
data, sezioni, categorie, e per ogni ricetta dosi, tempi, autore, link, strumenti,
ingredienti, procedimento numerato e note — e apre la stampa di sistema. Da iPhone:
*Condividi → Stampa → Salva su File*. Su computer: *Salva come PDF*.

Non serve nessuna libreria: la pagina è composta dall'app e il PDF lo fa il sistema. Il
blocco `#stampa` esiste solo dentro `@media print`, quindi a schermo non pesa niente.
Le regole di stampa devono sciogliere `position:fixed` di `html`/`body`, altrimenti
uscirebbe solo la prima pagina.

**Una singola ricetta.** Nella schermata di dettaglio, in sola lettura, il pulsante **PDF**
accanto a Modifica produce una **scheda** con i colori e i caratteri dell'app — carta,
Anton, cifre dipinte, icone — invece della versione in bianco e nero pensata per un intero
ricettario. Da iPhone: dal foglio di stampa tocca l'anteprima per aprire *Anteprima
rapida*, poi il tasto di condivisione per mandare il PDF via mail, Messaggi o *Salva su
File*.

L'app non si stampa mai: sia il ricettario completo sia la singola ricetta vengono
**composti dentro `#stampa`**, un contenuto per volta, quindi non possono sovrapporsi. La
classe `singola` sul contenitore sceglie quale dei due fogli di stile applicare.

Tre cose che questa funzione ha insegnato, tutte scoperte sbagliando:

1. **Le maschere CSS non si stampano** (almeno su Safari). Le icone e le cifre a schermo
   sono maschere alpha colorate dal CSS (`background-color` + `mask-image`): in stampa la
   maschera viene ignorata e resta il solo colore di fondo, che riempie tutto il
   rettangolo — da cui quadrati rossi e neri al posto delle icone. In stampa servono
   `<img>` con il colore già dentro il file: `tools/mkstampa.py` genera le 54 varianti
   `assets/p-*.png` a partire dalle maschere, tenendo l'alpha e imponendo l'RGB. Un `<img>`
   è contenuto, non decorazione, e viene sempre stampato.
2. **`print-color-adjust` va messo anche sull'elemento, non solo sui discendenti.** La
   prima versione usava `.contenitore *`, e il selettore universale non corrisponde
   all'elemento su cui sta il fondo: la carta non veniva stampata affatto. Serve
   `.contenitore, .contenitore *`.
3. **Impilare tutto in colonna unica non entra in una pagina.** Una prima versione teneva
   la stessa struttura verticale della schermata (una scheda stretta, ~118 mm, centrata):
   misurata, usciva **270 mm di contenuto contro i 269 disponibili** su A4 — sforava di un
   millimetro e finiva su una seconda pagina, per qualunque ricetta con più di pochissimi
   ingredienti o passi. La scheda ora usa tutta la larghezza stampabile (184 mm) e
   **Ingredienti e Procedimento stanno affiancati in due colonne**, come nel ricettario
   completo: l'altezza finale è quella della colonna più alta, non la somma delle due. La
   ricetta più lunga fra le 30 importate (7 ingredienti in tre gruppi, 7 passi) misura
   173 mm — 96 mm di margine.

Il link «Ricetta originale» è un `<a href>` con l'indirizzo vero, **mai** la riscrittura
`x-safari-https://` usata a schermo: in un PDF sarebbe uno schema che nessun lettore sa
aprire. L'indirizzo è anche scritto per esteso, così resta utile anche su carta.

**Dal pannello Supabase**, senza toccare l'app: Table Editor → tabella → il menu `⋮` in
alto a destra della griglia → *Export data* → *Download as CSV*. Due file, uno per
tabella. È l'export grezzo, comodo se serve rimettere i dati in un database.

## Pagina piena su iPhone

`apple-mobile-web-app-status-bar-style` è impostato a **`black-translucent`**: in modalità
standalone la pagina si estende sotto la barra di stato e sotto la barra home, senza bande
opache sopra e sotto. Serve anche a evitare che quelle bande restino verdi nella vista
Dolci: in standalone iOS decide il loro colore una volta sola, dal `theme_color` del
manifest, e ignora il `theme-color` cambiato via JavaScript.

Le zone sicure sono rispettate con `env(safe-area-inset-top / bottom)`, così i comandi non
finiscono sotto l'orologio o sotto la barra home. I comandi (← Indice, Modifica, Nuova
ricetta, Salate/Dolci, frecce) **galleggiano** sopra il contenuto invece di occupare una
striscia.

Perché la pagina sia davvero piena servono tre accorgimenti, ognuno dei quali è già
costato una banda indesiderata:

1. **nessun `theme_color`**, né nel manifest né in un meta tag — è quello a disegnare la
   banda opaca dietro l'orologio, e in standalone iOS lo legge una volta sola
   all'installazione, quindi resterebbe del colore della vista Salate anche nei Dolci;
2. **lo sfondo dipinto su `html`**, non solo su `body` — con `body` in `position:fixed`
   WebKit non propaga il suo sfondo alla tela del documento, che resta trasparente e viene
   riempita da iOS;
3. **nessuna altezza in `vh`/`dvh`**: `html`, `body` e `.wrap` sono ancorati con
   `position:fixed`/`absolute` e `inset:0`. In standalone `100dvh` risultava più basso
   dello schermo e lasciava scoperta una striscia in fondo. `.wrap` non ha sfondo proprio
   per la stessa ragione: così non può esistere una giunzione fra due texture.

> Se sul tuo iPhone le icone della barra di stato risultassero poco leggibili sulla carta
> chiara, si torna indietro cambiando quel valore in `default` in `index.html`.

## Velocità del salvataggio

Tre accorgimenti, tutti nati da un salvataggio che risultava lento:

1. **Rinnovo preventivo del token.** `assicuraToken()` controlla `expiresAt` *prima* di
   scrivere e rinnova solo se serve. Prima il token scaduto veniva scoperto dal fallimento:
   tentativo respinto → rinnovo → nuovo tentativo, cioè **tre viaggi di rete invece di uno**.
   È il caso tipico quando si riapre l'app dopo un'ora, perché iOS congela i timer e il
   rinnovo periodico non scatta.
2. **Ritentativo solo su 401.** Prima si ritentava su qualsiasi errore, quindi un problema
   di rete o del server costava tre viaggi prima di dire che non era andata.
3. **Controllo periodico leggero.** Ogni 30 secondi `controllaNovita()` chiede solo
   `id,updated_at` (poche centinaia di byte) e scarica le ricette per intero soltanto se
   la firma è cambiata. Prima riscaricava tutto, contenuto compreso, ogni mezzo minuto.

## Cose volutamente non fatte

- **Foto del piatto**: rimandata (richiede Supabase Storage, upload e ridimensionamento
  lato client). Il posto nel layout si recupera facilmente quando la vuoi.
- **Spostare una ricetta da salato a dolce**: sono due tabelle distinte, servirebbe una
  copia + cancellazione. Oggi va ricreata nell'altra vista.
- **Modifica offline**: i dati sono condivisi, quindi il salvataggio va sempre online.
  Resta una cache locale di sola lettura per aprire l'app all'istante.
