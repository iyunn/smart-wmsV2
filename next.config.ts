import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Build mandiri (.next/standalone) untuk dijalankan sebagai Windows Service di PC server
  // tanpa node_modules lengkap (ARCHITECTURE D-12, D-33).
  output: "standalone",
  // Tidak mengiklankan versi framework di header respons
  poweredByHeader: false,
  // Header keamanan dasar (ARCHITECTURE §6). Hanya boleh di-embed oleh halaman SmartWMS sendiri.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },   // preview PDF SJ memakai iframe (blob)
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
