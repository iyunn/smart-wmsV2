import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { SessionProvider } from "@/components/SessionContext";
import { ThemeProvider } from "@/components/ThemeContext";

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
    <html lang="id" className="h-full antialiased">
      <head>
        {/* Anti-flash: apply tema dari localStorage cache sebelum React mount.
            DB tetap sumber kebenaran (di-sync oleh ThemeProvider setelah login). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('swms-theme');if(t!=='light')t='dark';document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
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
