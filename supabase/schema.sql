-- Database del configuratore QG Bags (copia dell'Archivio).
-- Ogni scheda dell'Archivio è una tabella: id + documento completo in jsonb, così i moduli possono crescere senza migrazioni.
create table if not exists modelli      (id text primary key, dati jsonb not null, aggiornato timestamptz not null default now());
create table if not exists tessuti      (id text primary key, dati jsonb not null, aggiornato timestamptz not null default now());
create table if not exists manici       (id text primary key, dati jsonb not null, aggiornato timestamptz not null default now());
create table if not exists collezioni   (id text primary key, dati jsonb not null, aggiornato timestamptz not null default now());
-- abbinamenti/matrice, impostazioni/ricamo, tessuto/<vista> (verso del tessuto), percorsi/<vista> (manici)
create table if not exists impostazioni (id text primary key, dati jsonb not null, aggiornato timestamptz not null default now());
-- file caricati (foto, maschere, scansioni): l'id è lo stesso dell'Archivio, il file sta nel bucket "file"
create table if not exists file (id text primary key, nome text, tipo text, byte int, percorso text not null, aggiornato timestamptz not null default now());

alter table modelli enable row level security;
alter table tessuti enable row level security;
alter table manici enable row level security;
alter table collezioni enable row level security;
alter table impostazioni enable row level security;
alter table file enable row level security;
-- lettura pubblica (servirà al configuratore dei clienti); scrittura solo con la chiave di servizio
create policy "lettura" on modelli for select using (true);
create policy "lettura" on tessuti for select using (true);
create policy "lettura" on manici for select using (true);
create policy "lettura" on collezioni for select using (true);
create policy "lettura" on impostazioni for select using (true);
create policy "lettura" on file for select using (true);

insert into storage.buckets (id, name, public) values ('file','file',true) on conflict (id) do nothing;
