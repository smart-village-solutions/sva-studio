/**
 * Root-Route-Konfiguration der Anwendung inklusive Dokument-Shell.
 */
import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { createServerOnlyFn } from '@tanstack/react-start';
import React from 'react';

import AppShell from '../components/AppShell';
import DevelopmentLogConsole from '../components/DevelopmentLogConsole';
import ErrorFallback from '../components/ErrorFallback';
import NotFound from '../components/NotFound';
import { AuthProvider } from '../providers/auth-provider';
import { LocaleProvider } from '../providers/locale-provider';
import { ThemeProvider } from '../providers/theme-provider';
import { t } from '../i18n';

import appCss from '../styles.css?url';

const tanstackDevtoolsEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TANSTACK_DEVTOOLS === 'true';

export const ensureRootSdkInitialized = createServerOnlyFn(async () => {
  const { ensureSdkInitialized } = await import('../lib/init-sdk.server');
  await ensureSdkInitialized();
});

/**
 * Initialisiert serverseitig notwendige SDK-Bausteine für die Root-Route.
 */
export const loadRootData = async () => {
  if (import.meta.env.SSR) {
    await ensureRootSdkInitialized();
  }
  return {};
};

/**
 * Definiert Meta- und Link-Tags für das Root-Dokument.
 */
export const getRootHead = () => ({
  meta: [
    {
      charSet: 'utf-8',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
    {
      title: 'SVA Studio',
    },
  ],
  links: [
    {
      rel: 'stylesheet',
      href: appCss,
    },
  ],
});

export const Route = createRootRoute({
  errorComponent: ErrorFallback,
  notFoundComponent: NotFound,
  loader: loadRootData,
  head: getRootHead,
  component: RootComponent,
});

export const rootRoute = Route;

/**
 * Rendert das HTML-Grundgerüst mit Header, Shell-Layout und Devtools.
 *
 * Die Shell zeigt Loading-Skeletons ausschließlich bei aktiver Router-Pending-Phase.
 */
function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

export function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  const isRouterPending = useRouterState({
    select: (state) => state.status === 'pending' || state.isLoading,
  });
  const currentPathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [currentPathname]);

  const isShellLoading = isHydrated && isRouterPending;

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground" suppressHydrationWarning>
        <AuthProvider>
          <LocaleProvider>
            <a
              href="#main-content"
              onClick={() => {
                const mainElement = globalThis.document.getElementById('main-content');
                if (mainElement) {
                  mainElement.focus();
                }
              }}
              className="sr-only left-3 top-3 z-50 rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-shell focus:not-sr-only focus:absolute"
            >
              {t('shell.skipToContent')}
            </a>
            <ThemeProvider>
              <AppShell
                currentPathname={currentPathname}
                isLoading={isShellLoading}
                isMobileSidebarOpen={isMobileSidebarOpen}
                onMobileSidebarOpenChange={setIsMobileSidebarOpen}
              >
                {children}
              </AppShell>
            </ThemeProvider>
          </LocaleProvider>
        </AuthProvider>
        {tanstackDevtoolsEnabled ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        {import.meta.env.DEV ? <DevelopmentLogConsole /> : null}
        <Scripts />
      </body>
    </html>
  );
}
