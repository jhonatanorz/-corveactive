-- Public bucket for product images (created on `supabase start` / `db reset`).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- NOTE: the local admin user is created via the Auth Admin API after the stack
-- starts (see Task 1), not here — direct inserts into auth.users are brittle
-- across Supabase versions.
