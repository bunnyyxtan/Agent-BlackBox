import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "@/app/globals.css";

import { SuiWalletProvider } from "@/components/providers/SuiWalletProvider";
import { CursorGlow } from "@/components/ui/CursorGlow";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";
import { Analytics } from "@vercel/analytics/next";

/* ── Google Fonts via next/font ────────────────────── */

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Instrument Serif is not in the next/font/google catalogue's
// standard export, so we load it via <link> in <head> below.
// The CSS variable is set manually on <html>.

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/* ── Metadata ──────────────────────────────────────── */

export const metadata: Metadata = {
  title: {
    default: "Agent BlackBox — Verifiable Recorder for Autonomous AI",
    template: "%s | Agent BlackBox",
  },
  description:
    "The flight recorder for autonomous AI agents. Store traces on Walrus, anchor proof metadata on Sui, and verify through Tatum RPC.",
  icons: {
    icon: [
      { url: "/brand/agent-blackbox-logo.png", type: "image/png" },
      { url: "/brand/agent-blackbox-logo.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/agent-blackbox-logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/agent-blackbox-logo.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/brand/agent-blackbox-logo.png"],
  },
};

/* ── Root Layout ───────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      // Browser security extensions can inject attributes such as
      // bis_skin_checked before React hydrates. Keep suppression scoped to
      // the root instead of masking component-level hydration bugs.
      suppressHydrationWarning
    >
      <head>
        {/* Instrument Serif — italic accent font (not available via next/font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --font-instrument-serif: 'Instrument Serif', Georgia, serif; }`,
          }}
        />
      </head>

      <body className="bg-[#050507] text-zinc-300 font-sans antialiased overflow-x-hidden" suppressHydrationWarning>
        {/* Iconify icon library */}
        <Script
          src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"
          strategy="beforeInteractive"
        />

        <SuiWalletProvider>
          <CursorGlow />
          <AnimatedBackground>{children}</AnimatedBackground>
        </SuiWalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
