import type { PropsWithChildren } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050507] text-white lg:h-[100dvh] lg:overflow-hidden lg:flex-row">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <div className="hidden lg:block">
          <Navbar />
        </div>
        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-[94rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
