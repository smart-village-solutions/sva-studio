import { createPermissionDenialDetailsForAction } from '@sva/core';
import type { EffectivePermission } from '@sva/iam-core';

import type { ContentPrimitiveAuthorizationResult } from './server-authorization.model.js';

export const databaseUnavailableAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 503,
  error: 'database_unavailable',
  message: 'Berechtigungen konnten nicht geprüft werden.',
});

export const forbiddenAuthorizationResult = (
  action?: string,
  reason?: unknown
): ContentPrimitiveAuthorizationResult => {
  const permissionDenial = action
    ? createPermissionDenialDetailsForAction(action, reason)
    : undefined;
  return {
    ok: false,
    status: 403,
    error: 'forbidden',
    message: 'Keine Berechtigung für diese Inhaltsoperation.',
    ...(permissionDenial ? { permissionDenial } : {}),
  };
};

export const missingInstanceAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 400,
  error: 'missing_instance',
  message: 'Kein Instanzkontext für diese Inhaltsoperation vorhanden.',
});

export const invalidActionAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 400,
  error: 'invalid_action',
  message: 'Ungültige Action für diese Inhaltsoperation.',
});

export const allowedAuthorizationResult = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly permissions: readonly EffectivePermission[];
  readonly organizationId?: string;
}): ContentPrimitiveAuthorizationResult => ({
  ok: true,
  actor: {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  },
  permissions: input.permissions,
});
