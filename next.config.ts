import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Build mandiri (.next/standalone) untuk dijalankan sebagai Windows Service di PC server
  // tanpa node_modules lengkap (ARCHITECTURE D-12).
  output: "standalone",
};

export default nextConfig;
