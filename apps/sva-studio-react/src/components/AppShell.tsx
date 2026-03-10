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
  isMobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  sidebarSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
}>;

/**
 * Rendert das anwendungsweite Shell-Layout mit austauschbarem Sidebar-Slot.
 *
 * @param props - Konfiguration des Shell-Layouts.
 * @param props.children - Inhaltsbereich der aktuellen Route.
 * @param props.isLoading - Aktiviert Skeleton-Anzeige im Contentbereich.
 * @param props.sidebarSlot - Optionaler Ersatz für die Standard-Sidebar.
 */
export default function AppShell({
  children,
  isLoading = false,
  isMobileSidebarOpen = false,
  onMobileSidebarOpenChange,
  sidebarSlot,
  headerSlot,
}: AppShellProps) {
  return (
    <div className="flex w-full flex-1 bg-background">
      {sidebarSlot ?? (
        <Sidebar
          isLoading={isLoading}
          isMobileOpen={isMobileSidebarOpen}
          onMobileOpenChange={onMobileSidebarOpenChange}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {headerSlot}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          aria-busy={isLoading}
        >
        {isLoading ? (
          <section aria-label="Inhalt lädt" className="space-y-4">
            <span role="status" aria-live="polite" className="sr-only">
              Inhalt wird geladen.
            </span>
            <span aria-hidden="true" className="block h-8 w-48 animate-pulse rounded-md bg-muted" />
            <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-lg bg-card shadow-shell" />
            <div className="grid gap-4 md:grid-cols-2">
              <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-lg bg-card shadow-shell" />
              <span aria-hidden="true" className="block h-24 w-full animate-pulse rounded-lg bg-card shadow-shell" />
            </div>
          </section>
        ) : (
          children
        )}
        </main>
      </div>
    </div>
  );
}
