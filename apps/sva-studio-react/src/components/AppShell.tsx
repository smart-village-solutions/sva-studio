/**
 * Zentrale Layout-Shell der Anwendung.
 *
 * Die Shell orchestriert Sidebar und Contentbereich und stellt optional
 * einen konsistenten Skeleton-Zustand für den Hauptinhalt bereit.
 */
import React from 'react';

import { AppBreadcrumbs } from './AppBreadcrumbs';
import { ContextualHelpBoundary } from './ContextualHelpBoundary';
import Header from './Header';
import { t } from '../i18n';
import { redirectRolelessUser } from '../lib/auth-navigation';
import { studioPlugins } from '../lib/plugins';
import { useAuth } from '../providers/auth-provider';
import { useEffectiveAccess } from '../providers/effective-access-provider';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type LegalTextAcceptanceDialogComponent =
  typeof import('./LegalTextAcceptanceDialog').LegalTextAcceptanceDialog;

type AppShellProps = Readonly<{
  children: React.ReactNode;
  currentPathname?: string;
  isLoading?: boolean;
  isNavigating?: boolean;
  isMobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  sidebarSlot?: React.ReactNode;
  documentationPageId?: string;
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

const sidebarPlaceholder = (
  <aside
    aria-hidden="true"
    className="hidden shrink-0 space-y-2 border-r border-sidebar-border bg-sidebar px-3 pt-24 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-20 xl:w-72"
  >
    <span className="block h-11 animate-skeleton rounded-xl" />
    <span className="block h-11 animate-skeleton rounded-xl" />
    <span className="block h-11 animate-skeleton rounded-xl" />
  </aside>
);

const LazyPermissionsDegradedBanner = React.lazy(async () => {
  const module = await import('./PermissionsDegradedBanner');
  return {
    default: module.PermissionsDegradedBanner,
  };
});

const runtimeHealthIndicatorEnabled =
  import.meta.env.VITE_ENABLE_RUNTIME_HEALTH === 'true' &&
  import.meta.env.VITE_PLAYWRIGHT_TEST !== 'true';

export const shouldRenderLegalTextAcceptanceDialog = (input: {
  readonly isHydrated: boolean;
  readonly isAuthenticated: boolean;
}): boolean => input.isHydrated && input.isAuthenticated;

const LegalTextAcceptanceDialogSlot = ({
  enabled,
  pathname,
}: Readonly<{ enabled: boolean; pathname: string }>) => {
  const [DialogComponent, setDialogComponent] =
    React.useState<LegalTextAcceptanceDialogComponent | null>(null);

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

function useRoleAssignmentPending(auth: ReturnType<typeof useAuth>) {
  const {
    user,
    isAuthenticated: authenticated,
    isLoading: isLoading,
    hasResolvedSession,
    isRecoveringSession,
    error: authError,
  } = auth;
  const effectiveAccess = useEffectiveAccess();
  const showRoleAssignmentPending =
    authenticated &&
    hasResolvedSession &&
    !isLoading &&
    !isRecoveringSession &&
    !authError &&
    user?.permissionStatus === 'ok' &&
    user.roles.length === 0 &&
    user.permissionActions?.length === 0 &&
    effectiveAccess.snapshot.status === 'ready' &&
    effectiveAccess.snapshot.scope.kind === 'tenant' &&
    effectiveAccess.snapshot.scope.instanceId === user.instanceId &&
    effectiveAccess.permissionActions.length === 0;
  const rolelessRedirectUrl = user?.rolelessRedirectUrl;
  React.useEffect(() => {
    if (showRoleAssignmentPending) {
      redirectRolelessUser(rolelessRedirectUrl);
    }
  }, [showRoleAssignmentPending, rolelessRedirectUrl]);
  return showRoleAssignmentPending;
}

/**
 * Rendert das anwendungsweite Shell-Layout mit austauschbarem Sidebar-Slot.
 *
 * @param props - Konfiguration des Shell-Layouts.
 * @param props.children - Inhaltsbereich der aktuellen Route.
 * @param props.isLoading - Aktiviert Skeleton-Anzeige im Contentbereich.
 * @param props.isNavigating - Markiert den vorhandenen Inhalt während eines Routenwechsels als beschäftigt.
 * @param props.sidebarSlot - Optionaler Ersatz für die Standard-Sidebar.
 */
export default function AppShell({
  children,
  currentPathname = '/',
  isLoading = false,
  isNavigating = false,
  isMobileSidebarOpen = false,
  onMobileSidebarOpenChange,
  sidebarSlot,
  documentationPageId,
}: AppShellProps) {
  const auth = useAuth();
  const { isAuthenticated, isLoading: isAuthLoading } = auth;
  const showRoleAssignmentPending = useRoleAssignmentPending(auth);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const hasSidebarLayout = !studioPlugins.some((plugin) =>
    plugin.routes.some((route) => route.path === currentPathname && route.layout === 'content-only')
  );
  const showSidebar = hasSidebarLayout && isAuthenticated && !isAuthLoading;
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
            <React.Suspense fallback={sidebarPlaceholder}>
              <LazySidebar
                isMobileOpen={isMobileSidebarOpen}
                onMobileOpenChange={onMobileSidebarOpenChange}
              />
            </React.Suspense>
          ))
        : hasSidebarLayout && isAuthLoading
          ? sidebarPlaceholder
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
          aria-busy={isLoading || isNavigating}
        >
          {isLoading ? (
            <section aria-label={t('shell.content.loadingLabel')} className="space-y-4">
              <span role="status" aria-live="polite" className="sr-only">
                {t('shell.content.loadingStatus')}
              </span>
              <span aria-hidden="true" className="block h-8 w-48 animate-skeleton rounded-md" />
              <span
                aria-hidden="true"
                className="block h-24 w-full animate-skeleton rounded-lg shadow-shell"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <span
                  aria-hidden="true"
                  className="block h-24 w-full animate-skeleton rounded-lg shadow-shell"
                />
                <span
                  aria-hidden="true"
                  className="block h-24 w-full animate-skeleton rounded-lg shadow-shell"
                />
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              {showBreadcrumbs ? <AppBreadcrumbs pathname={currentPathname} /> : null}
              <React.Suspense fallback={null}>
                <LazyPermissionsDegradedBanner />
              </React.Suspense>
              {showRoleAssignmentPending ? (
                <Alert
                  role="status"
                  aria-live="polite"
                  aria-labelledby="role-assignment-pending-title"
                >
                  <AlertTitle id="role-assignment-pending-title">
                    {t('shell.roleAssignmentPending.title')}
                  </AlertTitle>
                  <AlertDescription>{t('shell.roleAssignmentPending.message')}</AlertDescription>
                </Alert>
              ) : null}
              {documentationPageId ? (
                <ContextualHelpBoundary
                  key={documentationPageId}
                  enabled={isAuthenticated}
                  pageId={documentationPageId}
                >
                  <div className="space-y-4">{children}</div>
                </ContextualHelpBoundary>
              ) : (
                <div className="space-y-4">{children}</div>
              )}
              {runtimeHealthIndicatorEnabled ? (
                <React.Suspense fallback={null}>
                  <LazyRuntimeHealthIndicator />
                </React.Suspense>
              ) : null}
            </div>
          )}
        </main>
        <LegalTextAcceptanceDialogSlot
          enabled={showLegalTextAcceptanceDialog}
          pathname={currentPathname}
        />
      </div>
    </div>
  );
}
