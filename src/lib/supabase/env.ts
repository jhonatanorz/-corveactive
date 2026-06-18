// Supabase connection values, resolved once and shared by every client.
// Prefer the new publishable key (sb_publishable_…); fall back to the legacy
// anon JWT so existing local/dev envs keep working without changes.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
