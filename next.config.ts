import type { NextConfig } from "next";

// Derive the Supabase Storage host from the env var so the same config works
// for local (http://127.0.0.1:54321) and the cloud project
// (https://<ref>.supabase.co) without hardcoding the project ref.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

// Next 16's image optimizer refuses hosts that resolve to a private IP (SSRF
// guard), which the local stack (127.0.0.1) always trips — so optimization is
// only possible against the public cloud host. Serve unoptimized locally,
// optimized in production.
const isLocalSupabase =
  !supabase || supabase.hostname === "127.0.0.1" || supabase.hostname === "localhost";

const nextConfig: NextConfig = {
  images: {
    unoptimized: isLocalSupabase,
    // Allow next/image to optimize public Supabase Storage objects (product photos).
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            ...(supabase.port ? { port: supabase.port } : {}),
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
