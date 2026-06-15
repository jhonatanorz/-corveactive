# Storage

Bucket `product-images` (public): holds product photos. Created by `supabase/seed.sql`.
Path convention: `products/<productId>/<epoch>-<filename>`.
Public read; authenticated (admin) write — enforced by the storage policies in
`migrations/0002_rls.sql`.

## Local admin user

Created via the Auth Admin API after `supabase start` (not in seed — direct
`auth.users` inserts are brittle across versions). Local dev credentials:

- email: `admin@corve.test`
- password: `corve1234`
