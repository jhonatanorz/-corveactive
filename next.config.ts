import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local Supabase Storage. Add the cloud project host (e.g. <ref>.supabase.co) at deploy time.
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
