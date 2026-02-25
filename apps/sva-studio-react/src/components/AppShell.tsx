/**
 * Zentrale Layout-Shell der Anwendung.
 *
 * Die Shell orchestriert Sidebar und Contentbereich und stellt optional
 * einen konsistenten Skeleton-Zustand für den Hauptinhalt bereit.
 */
import React from 'react';

import Sidebar from './Sidebar';

type AppShellProps = Readonly<{
  children: React.ReactNode;
  isLoading?: boolean;
  sidebarSlot?: React.ReactNode;
}>;

/**
 * Rendert das anwendungsweite Shell-Layout mit austauschbarem Sidebar-Slot.
 *
 * @param props - Konfiguration des Shell-Layouts.
 * @param props.children - Inhaltsbereich der aktuellen Route.
 * @param props.isLoading - Aktiviert Skeleton-Anzeige im Contentbereich.
 * @param props.sidebarSlot - Optionaler Ersatz für die Standard-Sidebar.
 */
export default function AppShell({ children, isLoading = false, sidebarSlot }: AppShellProps) {
  return (
    <div className="flex w-full flex-1 flex-col lg:flex-row">
      {sidebarSlot ?? <Sidebar isLoading={isLoading} />}
      <main
        id="main-content"
        className="flex min-h-[calc(100vh-76px)] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8"
        aria-busy={isLoading}
        aria-live="polite"
      >
        {isLoading ? (
          <section aria-label="Inhalt lädt" className="space-y-4">
            <output aria-live="polite" className="sr-only">
              Inhalt wird geladen.
            </output>
            <span aria-hidden="true" className="block h-8 w-48 animate-pulse rounded-md bg-slate-800" />
            <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-xl bg-slate-900" />
            <div className="grid gap-4 md:grid-cols-2">
              <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-xl bg-slate-900" />
              <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-xl bg-slate-900" />
            </div>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
