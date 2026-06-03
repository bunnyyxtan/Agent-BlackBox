"use client";

import {
  Boxes,
  Code2,
  Database,
  Gauge,
  Menu,
  PlusCircle,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentBlackBoxLogo } from "@/components/ui/AgentBlackBoxLogo";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/sessions", label: "Sessions", icon: ScrollText },
  { href: "/sessions/new", label: "Use Agent", icon: PlusCircle },
  { href: "/storage", label: "Storage", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/developer", label: "Developers", icon: Code2 },
];

const prefetchRoutes = ["/dashboard", "/sessions", "/sessions/new", "/storage", "/settings", "/developer", "/developers"];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    prefetchRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  function renderNavLinks() {
    return items.map(({ href, label, icon: Icon }) => {
      const active =
        pathname === href ||
        (href === "/sessions" && pathname.startsWith("/sessions/") && pathname !== "/sessions/new");
      return (
        <Link
          href={href}
          key={href}
          prefetch
          onClick={() => setMobileOpen(false)}
          onFocus={() => router.prefetch(href)}
          onMouseEnter={() => router.prefetch(href)}
          scroll={true}
          className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-xs font-medium transition lg:text-[13px] ${
            active
              ? "border border-white/10 bg-white/[0.04] text-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.02)]"
              : "border border-transparent text-zinc-500 hover:bg-white/[0.02] hover:text-white"
          }`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${active ? "text-indigo-400" : ""}`} />
          <span>{label}</span>
        </Link>
      );
    });
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050507]/88 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <AgentBlackBoxLogo size="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium tracking-tight text-white">
                Agent <span className="text-indigo-400">BlackBox</span>
              </span>
              <span className="block truncate text-[0.58rem] uppercase tracking-[0.18em] text-slate-500">
                Forensic Console
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-agent-blackbox-menu"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation</span>
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-agent-blackbox-menu"
            className="absolute inset-y-0 left-0 flex w-[min(21rem,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[#06060a]/98 shadow-[24px_0_80px_-40px_rgba(99,102,241,0.75)]"
          >
            <div className="flex min-h-20 items-center justify-between gap-3 border-b border-white/5 px-5">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <AgentBlackBoxLogo size="lg" />
                <span className="min-w-0 text-[15px] font-medium tracking-tight text-white">
                  Agent <span className="text-indigo-400">BlackBox</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08]"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close navigation</span>
              </button>
            </div>
            <div className="flex items-center gap-2 px-5 pb-2 pt-4">
              <Boxes className="h-4 w-4 text-zinc-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                Forensic Console
              </span>
            </div>
            <nav className="min-w-0 flex-1 space-y-1 overflow-y-auto px-4 py-2">
              {renderNavLinks()}
            </nav>
            <div className="border-t border-white/5 bg-gradient-to-t from-black/25 to-transparent px-4 py-5">
              <WalletConnectButton fullWidth />
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-[240px] flex-shrink-0 flex-col border-r border-white/5 bg-[#050507] lg:flex lg:h-[100dvh]">
        <div className="flex h-20 shrink-0 items-center border-b border-white/5 px-6">
          <Link href="/" className="group flex items-center gap-3">
            <AgentBlackBoxLogo size="lg" className="transition-shadow group-hover:shadow-[0_0_18px_-4px_rgba(124,58,237,0.8)]" />
            <span className="block text-[15px] font-medium tracking-tight text-white transition-colors group-hover:text-indigo-100">
              Agent <span className="text-indigo-400">BlackBox</span>
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-4">
          <Boxes className="h-4 w-4 text-zinc-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            Forensic Console
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="space-y-0.5 px-4 py-2">
            {renderNavLinks()}
          </nav>
        </div>

        <div className="mt-auto shrink-0 border-t border-white/5 bg-gradient-to-t from-black/20 to-transparent px-4 pb-5 pt-4">
          <div className="flex h-12 items-stretch">
            <WalletConnectButton fullWidth />
          </div>
        </div>
      </aside>
    </>
  );
}
