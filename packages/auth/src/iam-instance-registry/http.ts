import { createApiError } from '../iam-account-management/api-helpers.js';
import { requireRoles } from '../iam-account-management/shared-actor-resolution.js';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/sdk/server';
import { instanceStatuses } from '@sva/core';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.server.js';

const ADMIN_ROLES = new Set(['instance_registry_admin']);

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(instanceStatuses).optional(),
});

export const createInstanceSchema = z.object({
  instanceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  parentDomain: z.string().trim().min(1),
  themeKey: z.string().trim().min(1).optional(),
  mainserverConfigRef: z.string().trim().min(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

export const statusMutationSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
});

const isRootHostRequest = (request: Request): boolean => isCanonicalAuthHost(new URL(request.url).host);

export const ensurePlatformAccess = (request: Request, ctx: AuthenticatedRequestContext): Response | null => {
  if (!isRootHostRequest(request)) {
    return createApiError(403, 'forbidden', 'Globale Instanzverwaltung ist nur auf dem Root-Host erlaubt.', getWorkspaceContext().requestId);
  }

  return requireRoles(ctx, ADMIN_ROLES, getWorkspaceContext().requestId);
};

export const requireFreshReauth = (request: Request): Response | null => {
  const header = request.headers.get('x-sva-reauth-confirmed');
  if (header?.toLowerCase() === 'true') {
    return null;
  }

  return createApiError(403, 'reauth_required', 'Frische Re-Authentisierung ist für diese Mutation erforderlich.', getWorkspaceContext().requestId);
};

export const readDetailInstanceId = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const instanceIndex = segments.findIndex((segment) => segment === 'instances');
  return instanceIndex >= 0 ? segments[instanceIndex + 1] : undefined;
};
