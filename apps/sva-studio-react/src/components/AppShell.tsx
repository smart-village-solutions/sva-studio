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

type LegalTextAcceptanceDialogComponent = typeof import('./LegalTextAcceptanceDialog').LegalTextAcceptanceDialog;

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

const LazyPermissionsDegradedBanner = React.lazy(async () => {
  const module = await import('./PermissionsDegradedBanner');
  return {
    default: module.PermissionsDegradedBanner,
  };
});

const runtimeHealthIndicatorEnabled =
  import.meta.env.VITE_ENABLE_RUNTIME_HEALTH === 'true' && import.meta.env.VITE_PLAYWRIGHT_TEST !== 'true';

export const shouldRenderLegalTextAcceptanceDialog = (input: {
  readonly isHydrated: boolean;
  readonly isAuthenticated: boolean;
}): boolean => input.isHydrated && input.isAuthenticated;

const LegalTextAcceptanceDialogSlot = ({ enabled, pathname }: Readonly<{ enabled: boolean; pathname: string }>) => {
  const [DialogComponent, setDialogComponent] = React.useState<LegalTextAcceptanceDialogComponent | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setDialogComponent(null);
      return;
    }

    let isCancelled = false;

    const loadDialogComponent = async () => {
      try {
        const module = await import('./LegalTextAcceptanceDialog');
        if (isCancelled) {
          return;
        }
        setDialogComponent(() => module.LegalTextAcceptanceDialog);
      } catch {
        if (isCancelled) {
          return;
        }
        setDialogComponent(null);
      }
    };

    void loadDialogComponent();

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  if (!enabled || DialogComponent === null) {
    return null;
  }

  return <DialogComponent pathname={pathname} />;
};

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
  const showLegalTextAcceptanceDialog = shouldRenderLegalTextAcceptanceDialog({
    isHydrated,
    isAuthenticated,
  });

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className="isolate flex min-h-screen w-full flex-1 flex-col bg-background lg:flex-row">
      {showSidebar
        ? (sidebarSlot ?? (
        <React.Suspense fallback={null}>
          <LazySidebar
            isMobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={onMobileSidebarOpenChange}
          />
        </React.Suspense>
          ))
        : null}
      <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          isMobileNavigationOpen={isMobileSidebarOpen}
          onOpenMobileNavigation={
            showSidebar ? () => onMobileSidebarOpenChange?.(!isMobileSidebarOpen) : undefined
          }
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col bg-background px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 lg:px-8 lg:pt-6"
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
            <div className="space-y-4">
              {showBreadcrumbs ? <AppBreadcrumbs pathname={currentPathname} /> : null}
              <React.Suspense fallback={null}>
                <LazyPermissionsDegradedBanner />
              </React.Suspense>
              <div className="space-y-4">{children}</div>
              {runtimeHealthIndicatorEnabled ? (
                <React.Suspense fallback={null}>
                  <LazyRuntimeHealthIndicator />
                </React.Suspense>
              ) : null}
            </div>
          )}
        </main>
        <LegalTextAcceptanceDialogSlot enabled={showLegalTextAcceptanceDialog} pathname={currentPathname} />
      </div>
    </div>
  );
}
