/**
 * Zentrale Layout-Shell der Anwendung.
 *
 * Die Shell orchestriert Sidebar und Contentbereich und stellt optional
 * einen konsistenten Skeleton-Zustand für den Hauptinhalt bereit.
 */
import React from 'react';

import { AppBreadcrumbs } from './AppBreadcrumbs';
import Header from './Header';
import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';

type AppShellProps = Readonly<{
  children: React.ReactNode;
  currentPathname?: string;
  isLoading?: boolean;
  isMobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  sidebarSlot?: React.ReactNode;
}>;

const LazyRuntimeHealthIndicator = React.lazy(async () => {
  const module = await import('./RuntimeHealthIndicator');
  return {
    default: module.RuntimeHealthIndicator,
  };
});

const LazySidebar = React.lazy(async () => {
  const module = await import('./Sidebar');
  return {
    default: module.default,
  };
});

const LazyLegalTextAcceptanceDialog = React.lazy(async () => {
  const module = await import('./LegalTextAcceptanceDialog');
  return {
    default: module.LegalTextAcceptanceDialog,
  };
});

const LazyPermissionsDegradedBanner = React.lazy(async () => {
  const module = await import('./PermissionsDegradedBanner');
  return {
    default: module.PermissionsDegradedBanner,
  };
});

const runtimeHealthIndicatorEnabled = import.meta.env.VITE_PLAYWRIGHT_TEST !== 'true';

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
  currentPathname = '/',
  isLoading = false,
  isMobileSidebarOpen = false,
  onMobileSidebarOpenChange,
  sidebarSlot,
}: AppShellProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isHydrated, setIsHydrated] = React.useState(false);
  const showSidebar = isAuthenticated && !isAuthLoading;
  const showBreadcrumbs = isHydrated && currentPathname !== '/';

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className="isolate flex min-h-screen w-full flex-1 flex-col bg-background lg:flex-row">
      {showSidebar
        ? (sidebarSlot ?? (
        <React.Suspense fallback={null}>
          <LazySidebar
            isLoading={isLoading}
            isMobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={onMobileSidebarOpenChange}
          />
        </React.Suspense>
          ))
        : null}
      <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          isLoading={isLoading}
          isMobileNavigationOpen={isMobileSidebarOpen}
          onOpenMobileNavigation={
            showSidebar ? () => onMobileSidebarOpenChange?.(!isMobileSidebarOpen) : undefined
          }
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <section aria-label={t('shell.content.loadingLabel')} className="space-y-4">
              <span role="status" aria-live="polite" className="sr-only">
                {t('shell.content.loadingStatus')}
              </span>
              <span aria-hidden="true" className="block h-8 w-48 animate-skeleton rounded-md" />
              <span aria-hidden="true" className="block h-24 w-full animate-skeleton rounded-lg shadow-shell" />
              <div className="grid gap-4 md:grid-cols-2">
                <span aria-hidden="true" className="block h-24 w-full animate-skeleton rounded-lg shadow-shell" />
                <span aria-hidden="true" className="block h-24 w-full animate-skeleton rounded-lg shadow-shell" />
              </div>
            </section>
          ) : (
            <div className="space-y-6">
              {showBreadcrumbs ? <AppBreadcrumbs pathname={currentPathname} /> : null}
              <React.Suspense fallback={null}>
                <LazyPermissionsDegradedBanner />
              </React.Suspense>
              {children}
              {runtimeHealthIndicatorEnabled ? (
                <React.Suspense fallback={null}>
                  <LazyRuntimeHealthIndicator />
                </React.Suspense>
              ) : null}
            </div>
          )}
        </main>
        {isHydrated ? (
          <React.Suspense fallback={null}>
            <LazyLegalTextAcceptanceDialog pathname={currentPathname} />
          </React.Suspense>
        ) : null}
      </div>
    </div>
  );
}
