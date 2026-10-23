"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

/** Sidebar is a slide-in drawer below md, static column from md up. */
export function AppShell({
  sidebar,
  header,
  actions,
  children,
}: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-dvh overflow-hidden glass-canvas flex p-2 md:p-5 gap-5 relative">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className={`fixed inset-y-2 left-2 z-50 w-72 max-w-[85vw] transition-transform duration-200 md:static md:z-20 md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 gap-3 md:gap-5 relative z-10 overflow-hidden">
        <header className="h-14 glass-topbar rounded-xl px-3 md:px-6 flex items-center justify-between gap-2 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="md:hidden -ml-1 p-2 rounded-lg text-slate-800 hover:bg-white/50 cursor-pointer"
            >
              <Menu className="w-5 h-5" strokeWidth={2.25} />
            </button>
            {header}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">{actions}</div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto space-y-4 md:space-y-6 pb-8 md:pr-1">
          {children}
        </main>
      </div>
    </div>
  );
}
