-- supabase/migrations/0011_store_settings.sql
-- Editable store contact settings (key-value). Public reads, admin writes.

create table store_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- Seed the three channels. Socials get the real values already in the footer;
-- whatsapp starts blank for the admin to fill in.
insert into store_settings (key, value) values
  ('whatsapp', ''),
  ('instagram_url', 'https://www.instagram.com/corveactive/'),
  ('tiktok_url', 'https://www.tiktok.com/@corveactive');

alter table store_settings enable row level security;

create policy admin_all on store_settings
  for all to authenticated using (true) with check (true);
create policy public_read on store_settings
  for select to anon using (true);

grant select on store_settings to anon;
grant select, insert, update, delete on store_settings to authenticated;
