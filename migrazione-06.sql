-- ═══════════════════════════════════════════════════════════════
-- Migrazione 06 — da eseguire UNA VOLTA su Supabase (SQL Editor).
-- Nuova tabella per i link "da provare": una lista piatta e condivisa,
-- separata dalle ricette vere. Aperta dal pulsante "DA PROVARE"
-- nell'indice Salate.
--
-- Se stai partendo da zero, esegui solo schema.sql: lo ha già dentro.
-- ═══════════════════════════════════════════════════════════════

create table if not exists link_da_provare (
  id            uuid primary key default gen_random_uuid(),
  url           text        not null,
  nota          text        not null default '',
  created_by    uuid        default auth.uid(),
  created_at    timestamptz not null default now()
);

alter table link_da_provare enable row level security;

drop policy if exists "condiviso tra utenti autenticati" on link_da_provare;
create policy "condiviso tra utenti autenticati" on link_da_provare
  for all to authenticated using (true) with check (true);
