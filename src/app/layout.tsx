import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { SessionProvider } from "@/components/SessionContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/custom";

export const metadata: Metadata = {
  title: "SmartWMS — Smart Asset Monitoring & Reconciliation",
  description: "Smart Asset Monitoring and Reconciliation System — server lokal GA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: class & style <html> diubah skrip tema sebelum React hydrate
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Anti-flash: mode + warna custom dari cache localStorage dipasang sebelum React mount.
            DB tetap sumber kebenaran (disinkronkan ThemeProvider setelah profil dimuat). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
