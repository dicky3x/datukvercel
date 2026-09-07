import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pastikan file data (csv.gz mentah utk pencarian tematik AI, & aggregated.json
  // utk dashboard) ikut ter-bundle di serverless function saat deploy ke Vercel.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**"],
    "/api/dashboard": ["./data/**"],
  },
};

export default nextConfig;
