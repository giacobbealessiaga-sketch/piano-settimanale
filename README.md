# Piano Settimanale

Agenda settimanale web, ispirata all'app iPhone PianoSettimanale.

## Funzionalità
- Vista 7 giorni (Lun→Dom), con Sab/Dom in slot dimezzato
- Spirale centrale stile quaderno
- Aggiunta inline di task (spuntabili) e note testuali
- Modifica e cancellazione inline
- Navigazione per settimana (frecce o swipe)
- Calendario per saltare a qualsiasi settimana
- Pagina Appunti libera
- Tasto Oggi
- Dati salvati in localStorage (nessun server necessario)
- Dark mode automatica

## Come pubblicare su Vercel

1. Carica questi file su un repository GitHub
2. Vai su [vercel.com](https://vercel.com) → "Add New Project"
3. Collega il repository GitHub
4. Clicca "Deploy" — nessuna configurazione necessaria

Il sito sarà online su un URL tipo `piano-settimanale.vercel.app`.

## File
- `index.html` — struttura e stili
- `app.js` — tutta la logica
- `manifest.json` — configurazione PWA (aggiungibile alla home iPhone/Android)
