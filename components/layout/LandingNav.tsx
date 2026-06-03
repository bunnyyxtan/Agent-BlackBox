'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WalletConnectButton } from '@/components/ui/WalletConnectButton';
import { AgentBlackBoxLogo } from '@/components/ui/AgentBlackBoxLogo';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          icon: string;
          width?: string | number;
          height?: string | number;
        },
        HTMLElement
      >;
    }
  }
}

const navLinks = [
  { href: '#agents', label: 'Agents' },
  { href: '#how', label: 'How It Works' },
  { href: '#verify', label: 'Verify Proof' },
  { href: '#storage', label: 'Storage' },
  { href: '#developers', label: 'Developers' },
];

const appPrefetchRoutes = ['/dashboard', '/sessions', '/sessions/new', '/storage', '/settings', '/developer', '/developers'];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [openingApp, setOpeningApp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    appPrefetchRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#050507]/70 backdrop-blur-xl shadow-lg shadow-black/10' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <AgentBlackBoxLogo size="md" className="transition-shadow group-hover:shadow-[0_0_18px_-4px_rgba(124,58,237,0.8)]" />
          <span className="text-[0.95rem] font-semibold tracking-tight text-white">
            Agent BlackBox
          </span>
        </Link>

        {/* Center nav links — hidden on mobile */}
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

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <WalletConnectButton />
          </div>
          <Link
            href="/dashboard"
            prefetch
            aria-busy={openingApp}
            onClick={() => setOpeningApp(true)}
            onFocus={() => router.prefetch('/dashboard')}
            onMouseEnter={() => router.prefetch('/dashboard')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:bg-indigo-100 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] active:scale-[0.98]"
          >
            {openingApp && <iconify-icon icon="solar:spinner-linear" className="text-base animate-spin" />}
            {openingApp ? 'Opening...' : 'Open App'}
          </Link>
        </div>
      </div>
    </header>
  );
}
