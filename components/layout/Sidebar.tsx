"use client";

import {
  Boxes,
  Code2,
  Database,
  Gauge,
  PlusCircle,
  ScrollText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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

  useEffect(() => {
    prefetchRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  return (
    <aside className="flex-shrink-0 w-full lg:w-[240px] border-b lg:border-b-0 lg:border-r border-white/5 bg-[#050507] flex flex-col lg:h-[100dvh]">
      
      {/* Brand area for Desktop only. Mobile has Navbar. */}
      <div className="hidden lg:flex h-20 shrink-0 items-center px-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <AgentBlackBoxLogo size="lg" className="transition-shadow group-hover:shadow-[0_0_18px_-4px_rgba(124,58,237,0.8)]" />
          <span className="block text-[15px] font-medium tracking-tight text-white group-hover:text-indigo-100 transition-colors">
            Agent <span className="text-indigo-400">BlackBox</span>
          </span>
        </Link>
      </div>

      <div className="hidden px-5 pt-4 pb-2 lg:flex lg:items-center lg:gap-2 shrink-0">
        <Boxes className="h-4 w-4 text-zinc-500" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
          Forensic Console
        </span>
      </div>

      <div className="flex-1 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden">
        <nav className="flex gap-2 px-3 py-3 lg:flex-col lg:space-y-0.5 lg:px-4 lg:py-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/sessions" && pathname.startsWith("/sessions/") && pathname !== "/sessions/new");
            return (
              <Link
                href={href}
                key={href}
                prefetch
                onFocus={() => router.prefetch(href)}
                onMouseEnter={() => router.prefetch(href)}
                scroll={true}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 h-11 text-xs font-medium transition lg:text-[13px] ${
                  active
                    ? "border border-white/10 bg-white/[0.04] text-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.02)]"
                    : "border border-transparent text-zinc-500 hover:bg-white/[0.02] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-indigo-400" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Wallet section on desktop */}
      <div className="hidden lg:block shrink-0 border-t border-white/5 pt-4 pb-5 px-4 mt-auto bg-gradient-to-t from-black/20 to-transparent">
        <div className="h-12 flex items-stretch">
          <WalletConnectButton fullWidth />
        </div>
      </div>
    </aside>
  );
}
