"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { AgentBlackBoxLogo } from "@/components/ui/AgentBlackBoxLogo";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "iconify-icon": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          height?: number | string;
          icon: string;
          width?: number | string;
        },
        HTMLElement
      >;
    }
  }
}

const navLinks = [
  { href: "#agents", label: "Agents" },
  { href: "#how", label: "How It Works" },
  { href: "#verify", label: "Verify Proof" },
  { href: "#storage", label: "Storage" },
  { href: "#developers", label: "Developers" },
];

const appPrefetchRoutes = [
  "/dashboard",
  "/sessions",
  "/sessions/new",
  "/storage",
  "/settings",
  "/developer",
  "/developers",
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [openingApp, setOpeningApp] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    appPrefetchRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#050507]/78 shadow-lg shadow-black/10 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-20 sm:px-6 lg:px-10">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <AgentBlackBoxLogo
              size="md"
              className="transition-shadow group-hover:shadow-[0_0_18px_-4px_rgba(124,58,237,0.8)]"
            />
            <span className="truncate text-[0.92rem] font-semibold tracking-tight text-white sm:text-[0.95rem]">
              Agent BlackBox
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-light text-zinc-400 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <WalletConnectButton />
            </div>
            <Link
              href="/dashboard"
              prefetch
              aria-busy={openingApp}
              onClick={() => setOpeningApp(true)}
              onFocus={() => router.prefetch("/dashboard")}
              onMouseEnter={() => router.prefetch("/dashboard")}
              className="hidden min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:bg-indigo-100 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98] sm:inline-flex"
            >
              {openingApp && <iconify-icon icon="solar:spinner-linear" className="animate-spin text-base" />}
              {openingApp ? "Opening..." : "Open App"}
            </Link>
            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id="landing-mobile-menu"
            className="absolute inset-x-3 top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#07070c]/98 p-4 shadow-[0_24px_90px_-45px_rgba(99,102,241,0.85)]"
          >
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
                <AgentBlackBoxLogo size="md" />
                <span className="truncate text-sm font-semibold text-white">Agent BlackBox</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <nav className="mt-5 grid gap-2">
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-11 items-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 text-sm font-medium text-zinc-300 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-5 grid gap-3 border-t border-white/[0.08] pt-5">
              <WalletConnectButton fullWidth />
              <Link
                href="/dashboard"
                prefetch
                onClick={() => {
                  setOpeningApp(true);
                  setMobileOpen(false);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-indigo-100"
              >
                {openingApp ? "Opening..." : "Open App"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
