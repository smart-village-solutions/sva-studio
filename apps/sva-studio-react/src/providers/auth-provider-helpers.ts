import { createOperationLogger } from '../lib/browser-operation-logging';
import { recordAuthDiagnosticEvent } from '../lib/auth-diagnostics';
import {
  createLoginHref,
  createSessionExpiredHref,
  resolveCurrentReturnTo,
} from '../lib/auth-navigation';
import { DEFAULT_MAINSERVER_VISIBLE_TYPES } from '../lib/iam-content-list-api.shared';
import type { IamHttpError } from '../lib/iam-api';
import type { AuthDiagnosticMeta, AuthMeResponse, SessionUser } from './auth-provider-types';

export const AUTH_ME_ENDPOINT = '/auth/me';
export const AUTH_LOGOUT_ENDPOINT = '/auth/logout';
export const LOGOUT_INTENT_HEADER = 'x-sva-logout-intent';
export const LOGOUT_INTENT_VALUE = 'user';
export const SILENT_SSO_MESSAGE_TYPE = 'sva-auth:silent-sso';
const isProductionMode = import.meta.env.PROD;
export const isTestRuntime = () =>
  import.meta.env.MODE === 'test' ||
  import.meta.env.VITE_PLAYWRIGHT_TEST === 'true' ||
  import.meta.env.VITEST === true ||
  import.meta.env.VITEST === 'true';
export const SILENT_SSO_TIMEOUT_MS = isTestRuntime() ? 250 : 8_000;
export const PRE_EXPIRY_REAUTH_LEAD_MS = 60_000;
const PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS = 1_000;
export const MODULE_ACCESS_REVALIDATION_INTERVAL_MS = 10_000;
export const AUTH_DEBUG_ENABLED = !isProductionMode;
export const authLogger = createOperationLogger(
  'auth-provider',
  AUTH_DEBUG_ENABLED ? 'debug' : 'info'
);
const MAIN_SERVER_VISIBLE_TYPE_BY_READ_ACTION = new Map<string, string>([
  ['news.read', 'news.article'],
  ['events.read', 'events.event-record'],
  ['poi.read', 'poi.point-of-interest'],
  ['generic-items.read', 'generic-items.generic-item'],
  ['faq.read', 'faq.faq'],
  ['cockpit-cards.read', 'cockpit-cards.cockpit-card'],
  ['projects.read', 'projects.project'],
  ['surveys.read', 'surveys.survey'],
]);

export const readAuthDiagnosticMeta = (
  error: IamHttpError | undefined
): Partial<AuthDiagnosticMeta> => ({
  classification: error?.classification,
  diagnosticStatus: error?.diagnosticStatus,
  reasonCode: error?.safeDetails?.reason_code,
  requestId: error?.requestId,
  safeDetails: error?.safeDetails,
  status: error?.status,
});

export const redirectToSessionExpiredNotice = (meta: AuthDiagnosticMeta): void => {
  const currentWindow = globalThis.window;
  if (!currentWindow || currentWindow.location.pathname === '/') {
    return;
  }

  recordAuthDiagnosticEvent({
    authFlowId: meta.authFlowId,
    attempt: meta.attempt,
    classification: meta.classification,
    diagnosticStatus: meta.diagnosticStatus,
    event: 'auth_redirect_session_expired',
    pathname: currentWindow.location.pathname,
    reasonCode: meta.reasonCode,
    recoveryStep: meta.recoveryStep ?? 'redirect_session_expired',
    requestId: meta.requestId,
    result: 'failed',
    safeDetails: meta.safeDetails,
    status: meta.status,
  });
  currentWindow.location.assign(createSessionExpiredHref(resolveCurrentReturnTo()));
};

export const redirectToLogin = (meta: AuthDiagnosticMeta): void => {
  const currentWindow = globalThis.window;
  if (!currentWindow) {
    return;
  }

  recordAuthDiagnosticEvent({
    authFlowId: meta.authFlowId,
    attempt: meta.attempt,
    classification: meta.classification,
    diagnosticStatus: meta.diagnosticStatus,
    event: 'auth_redirect_login_required',
    pathname: currentWindow.location.pathname,
    reasonCode: meta.reasonCode,
    recoveryStep: meta.recoveryStep ?? 'redirect_login_required',
    requestId: meta.requestId,
    result: 'failed',
    safeDetails: meta.safeDetails,
    status: meta.status,
  });
  currentWindow.location.assign(createLoginHref(resolveCurrentReturnTo()));
};

export const parseAuthUser = (payload: unknown): SessionUser | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as AuthMeResponse;
  if (!candidate.user || typeof candidate.user !== 'object') {
    return null;
  }

  return candidate.user;
};

export const parseSessionExpiresAt = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as AuthMeResponse;
  return typeof candidate.expiresAt === 'number' && Number.isFinite(candidate.expiresAt)
    ? candidate.expiresAt
    : undefined;
};

export const computePreExpiryRetryDelayMs = (msUntilExpiry: number): number => {
  if (msUntilExpiry <= PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS) {
    return Math.max(1, Math.floor(msUntilExpiry / 2));
  }

  return msUntilExpiry - PRE_EXPIRY_REAUTH_RETRY_SAFETY_MS;
};

export const resolveReadableMainserverVisibleTypes = (
  permissionActions: readonly string[] | undefined
): readonly string[] => {
  if (!permissionActions || permissionActions.length === 0) {
    return [];
  }

  const grantedActions = new Set(permissionActions);
  return DEFAULT_MAINSERVER_VISIBLE_TYPES.filter((visibleType) =>
    [...MAIN_SERVER_VISIBLE_TYPE_BY_READ_ACTION.entries()].some(
      ([actionId, mappedVisibleType]) =>
        mappedVisibleType === visibleType && grantedActions.has(actionId)
    )
  );
};
