/**
 * Root-Route-Konfiguration der Anwendung inklusive Dokument-Shell.
 */
import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { createServerFn } from '@tanstack/react-start';
import React from 'react';

import AppShell from '../components/AppShell';
import Header from '../components/Header';
import NotFound from '../components/NotFound';

import appCss from '../styles.css?url';

/**
 * Initialisiert serverseitig notwendige SDK-Bausteine für die Root-Route.
 */
let sdkInitialized = false;

const ensureSdkInitialized = createServerFn().handler(async () => {
  if (sdkInitialized) {
    return { initialized: true };
  }

  const { initializeOtelSdk } = await import('@sva/sdk/server');
  await initializeOtelSdk();
  sdkInitialized = true;

  return { initialized: true };
});

const loadRootData = async () => {
  // Run SDK bootstrap only on the server.
  if (import.meta.env.SSR) {
    await ensureSdkInitialized();
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
  notFoundComponent: NotFound,
  loader: loadRootData,
  head: getRootHead,

  shellComponent: RootDocument,
});

export const rootRoute = Route;

/**
 * Rendert das HTML-Grundgerüst mit Header, Shell-Layout und Devtools.
 *
 * Die Komponente zeigt Skeletons nur bis zur abgeschlossenen Hydration,
 * damit serverseitig gerenderte Inhalte sofort verfügbar bleiben.
 */
function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  const isShellLoading = false;

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
