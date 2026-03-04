/**
 * Root-Route-Konfiguration der Anwendung inklusive Dokument-Shell.
 */
import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { createServerOnlyFn } from '@tanstack/react-start';
import React from 'react';

import AppShell from '../components/AppShell';
import ErrorFallback from '../components/ErrorFallback';
import Header from '../components/Header';
import NotFound from '../components/NotFound';

import appCss from '../styles.css?url';

const ensureRootSdkInitialized = createServerOnlyFn().handler(async () => {
  const { ensureSdkInitialized } = await import('../lib/init-sdk.server');
  await ensureSdkInitialized();
});

/**
 * Initialisiert serverseitig notwendige SDK-Bausteine für die Root-Route.
 */
const loadRootData = async () => {
  if (import.meta.env.SSR) {
    await ensureRootSdkInitialized();
  }
  return {};
};

/**
 * Definiert Meta- und Link-Tags für das Root-Dokument.
 */
const getRootHead = () => ({
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

  shellComponent: RootDocument,
});

export const rootRoute = Route;

/**
 * Rendert das HTML-Grundgerüst mit Header, Shell-Layout und Devtools.
 *
 * Die Shell zeigt Loading-Skeletons ausschließlich bei aktiver Router-Pending-Phase.
 */
function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  const isShellLoading = useRouterState({
    select: (state) => state.status === 'pending' || state.isLoading,
  });

  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
        <a
          href="#main-content"
          onClick={() => {
            const mainElement = globalThis.document.getElementById('main-content');
            if (mainElement) {
              mainElement.focus();
            }
          }}
          className="sr-only left-3 top-3 z-50 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 focus:not-sr-only focus:absolute"
        >
          Zum Inhalt springen
        </a>
        <Header isLoading={isShellLoading} />
        <AppShell isLoading={isShellLoading}>{children}</AppShell>
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
        <Scripts />
      </body>
    </html>
  );
}
