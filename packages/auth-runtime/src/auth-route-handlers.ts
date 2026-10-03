import { initializeOtelSdk } from '@sva/server-runtime';

import { buildLogContext } from './log-context.js';
import { DEFAULT_WORKSPACE_ID } from './scope.js';
import { logger } from './auth-route-responses.js';

void initializeOtelSdk().catch((error: unknown) => {
  logger.error('Fehler bei OTEL SDK Initialisierung im Auth-Modul', {
    component: 'iam-auth',
    dependency: 'otel',
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'otel_init_failed',
    ...buildLogContext(DEFAULT_WORKSPACE_ID),
  });
});

export { loginHandler, accountActionHandler, devLoginHandler } from './auth-route-login.js';
export { callbackHandler } from './auth-route-callback.js';
export { meHandler } from './auth-route-me.js';
export { devLogoutHandler, logoutHandler } from './auth-route-logout.js';
