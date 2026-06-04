import { createServerFn } from '@tanstack/react-start';

import type { SvaMainserverConnectionStatus } from '@sva/sva-mainserver';

const MAIN_SERVER_PERMISSION_ACTION = 'integration.manage';
type SvaMainserverLogger = {
  warn: (message: string, meta: Record<string, unknown>) => void;
};

let loggerPromise: Promise<SvaMainserverLogger> | null = null;

const getLogger = async (): Promise<SvaMainserverLogger> => {
  loggerPromise ??= import('@sva/server-runtime').then(({ createSdkLogger }) =>
    createSdkLogger({ component: 'sva-mainserver-route', level: 'info' }),
  );

  return loggerPromise;
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createErrorStatus = (message: string, errorCode: SvaMainserverConnectionStatus['errorCode'] = 'forbidden'): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode,
  errorMessage: message,
});

const createUnauthorizedStatus = (message: string): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode: 'unauthorized',
  errorMessage: message,
});

export const loadSvaMainserverConnectionStatus = createServerFn().handler(async (): Promise<SvaMainserverConnectionStatus> => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { authorizeInstancePermissionForUser, withAuthenticatedUser } = await import('@sva/auth-runtime/server');
  const { getSvaMainserverConnectionStatus } = await import('@sva/sva-mainserver/server');

  const request = getRequest();
  const response = await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      (await getLogger()).warn('SVA Mainserver access denied because the session has no instance context', {
        workspace_id: 'unknown',
        operation: 'load_sva_mainserver_connection_status',
        decision: 'deny',
        reason: 'missing_instance_context',
      });
      return jsonResponse(400, {
        ...createErrorStatus('Kein Instanzkontext in der aktuellen Session vorhanden.', 'invalid_config'),
      } satisfies SvaMainserverConnectionStatus);
    }

    const authorization = await authorizeInstancePermissionForUser({
      ctx,
      action: MAIN_SERVER_PERMISSION_ACTION,
    });
    if (!authorization.ok) {
      (await getLogger()).warn('SVA Mainserver access denied by integration permission check', {
        workspace_id: ctx.user.instanceId,
        operation: 'load_sva_mainserver_connection_status',
        decision: 'deny',
        reason:
          authorization.error === 'forbidden'
            ? 'missing_integration_manage_permission'
            : authorization.error,
      });
      return jsonResponse(authorization.status, {
        ...createErrorStatus(
          authorization.error === 'forbidden'
            ? 'Zugriff auf die Mainserver-Diagnostik ist nicht erlaubt.'
            : authorization.message,
          authorization.error === 'database_unavailable' ? 'database_unavailable' : 'forbidden'
        ),
      } satisfies SvaMainserverConnectionStatus);
    }

    const status = await getSvaMainserverConnectionStatus({
      instanceId: ctx.user.instanceId,
      keycloakSubject: ctx.user.id,
    });
    return jsonResponse(200, status);
  });

  const payload = (await response.json().catch(() => null)) as SvaMainserverConnectionStatus | null;
  if (payload && (payload.status === 'connected' || payload.status === 'error')) {
    return payload;
  }

  if (response.status === 401) {
    return createUnauthorizedStatus('Nicht authentifiziert. Bitte erneut anmelden.');
  }

  if (response.status === 403) {
    return createErrorStatus('Zugriff auf die Mainserver-Diagnostik ist nicht erlaubt.');
  }

  return createErrorStatus(`Unerwartete Antwort beim Laden des Mainserver-Status (${response.status}).`, 'network_error');
});
