-- ═══════════════════════════════════════════════════════════════
-- Ricettario — schema Supabase
-- Esegui questo file una sola volta in Supabase → SQL Editor → New query.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Tabelle ────────────────────────────────────────────────────
-- Due tabelle separate (salato / dolce) così la ricerca interroga
-- solo quella della vista corrente, come richiesto.

create table if not exists ricette_salate (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null,
  titolo        text not null,
  link          text        not null default '',
  dosi          text        not null default '',
  -- nome mostrato in fondo alla ricetta; se lasciato vuoto l'app ci mette
  -- la parte iniziale dell'email di chi salva
  autore        text        not null default '',
  prep_time     text        not null default '',
  cook_time     text        not null default '',
  total_time    text        not null default '',
  -- strumenti attivi: { "forno": "180° statico, 40 min", "padella": "" }
  -- la chiave è presente solo se l'icona è selezionata (rossa)
  tools         jsonb       not null default '{}'::jsonb,
  -- ingredienti: blocco testuale, un ingrediente per riga
  ingredienti   text        not null default '',
  -- procedimento: un elemento per passo, ["passo 1", "passo 2", ...]
  procedimento  jsonb       not null default '[]'::jsonb,
  -- strumentazione: chiavi delle icone selezionate, ["coltello","frusta"]
  strumenti     jsonb       not null default '[]'::jsonb,
  -- annotazioni libere che non sono passaggi (varianti, promemoria)
  note          text        not null default '',
  created_by    uuid        default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists ricette_dolci (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null,
  titolo        text not null,
  link          text        not null default '',
  dosi          text        not null default '',
  -- nome mostrato in fondo alla ricetta; se lasciato vuoto l'app ci mette
  -- la parte iniziale dell'email di chi salva
  autore        text        not null default '',
  prep_time     text        not null default '',
  cook_time     text        not null default '',
  total_time    text        not null default '',
  tools         jsonb       not null default '{}'::jsonb,
  ingredienti   text        not null default '',
  procedimento  jsonb       not null default '[]'::jsonb,
  created_by    uuid        default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ricette_salate_cat_idx on ricette_salate (categoria, created_at);
create index if not exists ricette_dolci_cat_idx  on ricette_dolci  (categoria, created_at);

-- Link da provare: una lista piatta e condivisa, aperta dal pulsante "DA
-- PROVARE" nell'indice Salate. Non è divisa salato/dolce né per categoria:
-- è un appunto veloce, non una ricetta — quando la si trasforma in una
-- ricetta vera si elimina la voce a mano, non c'è collegamento automatico.
create table if not exists link_da_provare (
  id            uuid primary key default gen_random_uuid(),
  url           text        not null,
  nota          text        not null default '',
  created_by    uuid        default auth.uid(),
  created_at    timestamptz not null default now()
);

-- ── Row Level Security ─────────────────────────────────────────
-- Ricettario CONDIVISO: qualsiasi utente autenticato vede e modifica
-- tutte le ricette. Gli utenti non autenticati non vedono nulla.

alter table ricette_salate enable row level security;
alter table ricette_dolci  enable row level security;

drop policy if exists "condiviso tra utenti autenticati" on ricette_salate;
create policy "condiviso tra utenti autenticati" on ricette_salate
  for all to authenticated using (true) with check (true);

drop policy if exists "condiviso tra utenti autenticati" on ricette_dolci;
create policy "condiviso tra utenti autenticati" on ricette_dolci
  for all to authenticated using (true) with check (true);

alter table link_da_provare enable row level security;

drop policy if exists "condiviso tra utenti autenticati" on link_da_provare;
create policy "condiviso tra utenti autenticati" on link_da_provare
  for all to authenticated using (true) with check (true);
