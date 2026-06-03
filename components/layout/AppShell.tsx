import type { PropsWithChildren } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#050507] text-white lg:flex-row">
      <div className="lg:hidden">
        <Navbar />
      </div>
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="hidden lg:block">
          <Navbar />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[94rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
