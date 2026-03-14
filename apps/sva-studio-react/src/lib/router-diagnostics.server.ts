// Diagnose-Artefakte für SSR-Routing-Debug auf Swarm-Deployments.
// Kontext: docs/staging/2026-03/router-diagnostik-2026-03-13.md

import { writeFile } from 'node:fs/promises';

import type { AnyRouter } from '@tanstack/react-router';

import { createRouterDiagnosticsSnapshot } from './router-diagnostics';

const ROUTER_DIAGNOSTICS_FILE = '/tmp/sva-router-diagnostics.json';
type RouterDiagnosticsLogger = {
  error: (message: string, meta: Record<string, unknown>) => void;
  info: (message: string, meta: Record<string, unknown>) => void;
  warn: (message: string, meta: Record<string, unknown>) => void;
};

let diagnosticsPromise: Promise<void> | null = null;
let moduleLoadPromise: Promise<void> | null = null;
let loggerPromise: Promise<RouterDiagnosticsLogger> | null = null;

const summarizeRoutes = (routes: string[]): string[] => {
  return routes.slice(0, 20);
};

const getLogger = async (): Promise<RouterDiagnosticsLogger> => {
  loggerPromise ??= import('@sva/sdk/server').then(({ createSdkLogger }) =>
    createSdkLogger({
      component: 'router-diagnostics',
      level: 'info',
      enableConsole: true,
      enableOtel: false, // OTEL deaktiviert: Diagnostik läuft vor/während OTEL-Init
    }),
  );

  return loggerPromise;
};

const logDiagnosticsError = async (message: string, error: unknown): Promise<void> => {
  (await getLogger()).error(message, {
    workspace_id: 'platform',
    environment: process.env.NODE_ENV ?? 'production',
    diagnostics_file: ROUTER_DIAGNOSTICS_FILE,
    error: error instanceof Error ? error.message : String(error),
    error_type: error instanceof Error ? error.constructor.name : 'unknown',
  });
};

export const emitRouterModuleLoadDiagnosticsOnce = (routeTree: unknown): Promise<void> => {
  moduleLoadPromise ??= (async () => {
    const snapshot = createRouterDiagnosticsSnapshot({
      routeTree,
      router: {},
      publicBaseUrl: process.env.SVA_PUBLIC_BASE_URL,
    });

    await writeFile(
      ROUTER_DIAGNOSTICS_FILE,
      `${JSON.stringify(
        {
          phase: 'router_module_loaded',
          ...snapshot,
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    (await getLogger()).info('Router-Modul geladen, Vorab-Diagnose geschrieben', {
      workspace_id: 'platform',
      environment: process.env.NODE_ENV ?? 'production',
      diagnostics_file: ROUTER_DIAGNOSTICS_FILE,
      route_tree_node_count: snapshot.routeTreeNodeCount,
      has_root_route: snapshot.routeFlags.hasRootRoute,
      has_demo_route: snapshot.routeFlags.hasDemoRoute,
    });
  })().catch(async (error: unknown) => {
    await logDiagnosticsError('Router-Modul-Diagnose konnte nicht geschrieben werden', error);
  });

  return moduleLoadPromise;
};

const writeRouterDiagnostics = async (router: AnyRouter, routeTree: unknown): Promise<void> => {
  const snapshot = createRouterDiagnosticsSnapshot({
    routeTree,
    router,
    publicBaseUrl: process.env.SVA_PUBLIC_BASE_URL,
  });

  await writeFile(ROUTER_DIAGNOSTICS_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  (await getLogger()).info('Router-Diagnose geschrieben', {
    workspace_id: 'platform',
    environment: process.env.NODE_ENV ?? 'production',
    diagnostics_file: ROUTER_DIAGNOSTICS_FILE,
    route_tree_node_count: snapshot.routeTreeNodeCount,
    route_ids: summarizeRoutes(snapshot.routerRegistry.routeIds),
    route_paths: summarizeRoutes(snapshot.routerRegistry.routePaths),
    flat_route_ids: summarizeRoutes(snapshot.routerRegistry.flatRouteIds),
    flat_route_paths: summarizeRoutes(snapshot.routerRegistry.flatRoutePaths),
    has_root_route: snapshot.routeFlags.hasRootRoute,
    has_demo_route: snapshot.routeFlags.hasDemoRoute,
  });

  if (!snapshot.routeFlags.hasRootRoute || snapshot.routerRegistry.routePaths.length === 0) {
    (await getLogger()).warn('Router-Diagnose zeigt fehlende Routenregistrierung', {
      workspace_id: 'platform',
      environment: process.env.NODE_ENV ?? 'production',
      diagnostics_file: ROUTER_DIAGNOSTICS_FILE,
      route_tree_node_count: snapshot.routeTreeNodeCount,
      route_ids: summarizeRoutes(snapshot.routerRegistry.routeIds),
      route_paths: summarizeRoutes(snapshot.routerRegistry.routePaths),
    });
  }
};

export const emitRouterDiagnosticsOnce = (router: AnyRouter, routeTree: unknown): Promise<void> => {
  diagnosticsPromise ??= writeRouterDiagnostics(router, routeTree).catch(async (error: unknown) => {
    await logDiagnosticsError('Router-Diagnose konnte nicht geschrieben werden', error);
  });

  return diagnosticsPromise;
};
