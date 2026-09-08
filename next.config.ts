import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pastikan file data (csv.gz mentah utk pencarian tematik AI, & aggregated.json
  // utk dashboard) ikut ter-bundle di serverless function saat deploy ke Vercel.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/**"],
    "/api/dashboard": ["./data/**"],
    "/api/kategori": ["./data/**"],
    "/api/tkd": ["./data/**"],
  },
};

export default nextConfig;
