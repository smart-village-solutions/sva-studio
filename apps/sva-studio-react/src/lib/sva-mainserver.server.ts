import { createServerFn } from '@tanstack/react-start';

import type { SvaMainserverConnectionStatus } from '@sva/sva-mainserver';

const MAIN_SERVER_ALLOWED_ROLES = new Set(['system_admin', 'app_manager', 'interface_manager', 'interface-manager']);

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const hasMainserverAccess = (roles: readonly string[]): boolean =>
  roles.some((role) => MAIN_SERVER_ALLOWED_ROLES.has(role.trim().toLowerCase()));

const createErrorStatus = (message: string): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode: 'forbidden',
  errorMessage: message,
});

export const loadSvaMainserverConnectionStatus = createServerFn().handler(async (): Promise<SvaMainserverConnectionStatus> => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { withAuthenticatedUser } = await import('@sva/auth/server');
  const { getSvaMainserverConnectionStatus } = await import('@sva/sva-mainserver/server');

  const request = getRequest();
  const response = await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      return jsonResponse(400, {
        ...createErrorStatus('Kein Instanzkontext in der aktuellen Session vorhanden.'),
      } satisfies SvaMainserverConnectionStatus);
    }

    if (!hasMainserverAccess(ctx.user.roles)) {
      return jsonResponse(403, {
        ...createErrorStatus('Lokale Studio-Berechtigung fuer die Mainserver-Diagnostik fehlt.'),
      } satisfies SvaMainserverConnectionStatus);
    }

    const status = await getSvaMainserverConnectionStatus({
      instanceId: ctx.user.instanceId,
      keycloakSubject: ctx.user.id,
    });
    return jsonResponse(200, status);
  });

  return (await response.json()) as SvaMainserverConnectionStatus;
});
