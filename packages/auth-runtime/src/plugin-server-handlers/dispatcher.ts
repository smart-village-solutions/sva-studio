import {
  evaluateUiAccess,
  type EffectivePermission,
  type UiResourceCapability,
} from '@sva/iam-core';
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
} from '@sva/plugin-sdk';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  translatePluginServerHandlerMessage,
  type PluginServerHandlerMessageKey,
} from './messages.js';

type EffectivePermissionsResolution = Awaited<ReturnType<typeof resolveEffectivePermissions>>;

export type PluginServerHandlerDispatcherDependencies = Readonly<{
  authenticate?: typeof withAuthenticatedUser;
  isPlatformHost?: (request: Request) => boolean;
  readTenantAccess?: typeof readConfiguredPluginTenantAccess;
  resolvePermissions?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly organizationId?: string;
  }) => Promise<EffectivePermissionsResolution>;
  resolveResourceCapability?: (input: {
    readonly request: Request;
    readonly descriptor: PluginServerHandlerRegistryEntry;
    readonly instanceId: string;
    readonly organizationId?: string;
    readonly actorAccountId: string;
  }) => Promise<UiResourceCapability | undefined>;
  validateCsrf?: typeof validateCsrf;
  translate?: (request: Request, key: PluginServerHandlerMessageKey) => string;
}>;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (trimmed === '/') return trimmed;
  return trimmed.replace(/\/+$/, '');
};

const satisfiesSet = (
  requirement: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>,
  available: ReadonlySet<string>
): boolean =>
  requirement.mode === 'allOf'
    ? requirement.values.every((value) => available.has(value))
    : requirement.values.some((value) => available.has(value));

const createError = (
  request: Request,
  translate: NonNullable<PluginServerHandlerDispatcherDependencies['translate']>,
  status: number,
  code: 'forbidden' | 'database_unavailable',
  messageKey: PluginServerHandlerMessageKey
) => createApiError(status, code, translate(request, messageKey), getWorkspaceContext().requestId);

const resolveTranslation = (
  dependencies: PluginServerHandlerDispatcherDependencies | undefined
): NonNullable<PluginServerHandlerDispatcherDependencies['translate']> =>
  dependencies?.translate ?? translatePluginServerHandlerMessage;

export const assertPluginServerHandlerCoverage = (input: {
  readonly descriptors: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly handlers: Readonly<Record<string, PluginServerExecutionHandler>>;
}): void => {
  const endpoints = new Map<string, string>();
  for (const descriptor of input.descriptors.values()) {
    const endpointKey = `${descriptor.method} ${descriptor.path}`;
    const existingHandlerId = endpoints.get(endpointKey);
    if (existingHandlerId) {
      throw new Error(
        `duplicate_plugin_server_endpoint:${endpointKey}:${existingHandlerId}:${descriptor.id}`
      );
    }
    endpoints.set(endpointKey, descriptor.id);
  }
  const declared = [...input.descriptors.keys()].sort();
  const registered = Object.keys(input.handlers).sort();
  const missing = declared.filter((handlerId) => !registered.includes(handlerId));
  if (missing.length > 0) {
    throw new Error(`missing_plugin_server_handlers:${missing.join(',')}`);
  }
  const unknown = registered.filter((handlerId) => !declared.includes(handlerId));
  if (unknown.length > 0) {
    throw new Error(`unknown_plugin_server_handlers:${unknown.join(',')}`);
  }
};

const authorizeTenantHandler = async (input: {
  readonly context: AuthenticatedRequestContext;
  readonly descriptor: PluginServerHandlerRegistryEntry;
  readonly readTenantAccess: typeof readConfiguredPluginTenantAccess;
  readonly resolvePermissions: NonNullable<
    PluginServerHandlerDispatcherDependencies['resolvePermissions']
  >;
  readonly request: Request;
  readonly resolveResourceCapability:
    PluginServerHandlerDispatcherDependencies['resolveResourceCapability'] | undefined;
  readonly translate: NonNullable<PluginServerHandlerDispatcherDependencies['translate']>;
}): Promise<Response | null> => {
  const requirement = input.descriptor.accessRequirement;
  if (requirement.kind !== 'tenant') {
    return createError(
      input.request,
      input.translate,
      403,
      'forbidden',
      'instanceScopeUnavailable'
    );
  }
  const instanceId = input.context.user.instanceId;
  if (!instanceId || requirement.moduleId !== input.descriptor.ownerPluginId) {
    return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
  }
  const tenantAccess = await input.readTenantAccess(instanceId, input.descriptor.ownerPluginId);
  if (!tenantAccess.allowed) {
    return createError(input.request, input.translate, 403, 'forbidden', 'pluginUnavailable');
  }
  const resolved = await input.resolvePermissions({
    instanceId,
    keycloakSubject: input.context.user.id,
    organizationId: input.context.activeOrganizationId,
  });
  if (!resolved.ok) {
    return createError(
      input.request,
      input.translate,
      503,
      'database_unavailable',
      'permissionCheckUnavailable'
    );
  }
  const resourceCapability = input.resolveResourceCapability
    ? await input.resolveResourceCapability({
        request: input.request,
        descriptor: input.descriptor,
        instanceId,
        ...(input.context.activeOrganizationId
          ? { organizationId: input.context.activeOrganizationId }
          : {}),
        actorAccountId: input.context.user.id,
      })
    : undefined;
  const decision = evaluateUiAccess({
    isAuthenticated: true,
    requirement,
    ...(resourceCapability ? { resourceCapability } : {}),
    snapshot: {
      status: 'ready',
      generation: 0,
      scope: {
        kind: 'tenant',
        authGeneration: 0,
        instanceId,
        organizationId: input.context.activeOrganizationId ?? null,
        moduleAssignmentGeneration: 0,
      },
      assignedModules: [input.descriptor.ownerPluginId],
      permissions: resolved.permissions as readonly EffectivePermission[],
    },
  });
  return decision.status === 'allowed'
    ? null
    : createError(input.request, input.translate, 403, 'forbidden', 'permissionDenied');
};

export const createPluginServerHandlerDispatcher = (input: {
  readonly descriptors: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly handlers: Readonly<Record<string, PluginServerExecutionHandler>>;
  readonly dependencies?: PluginServerHandlerDispatcherDependencies;
}): ((request: Request) => Promise<Response | null>) => {
  assertPluginServerHandlerCoverage(input);
  const authenticate = input.dependencies?.authenticate ?? withAuthenticatedUser;
  const isPlatformHost =
    input.dependencies?.isPlatformHost ??
    ((request: Request) => isCanonicalAuthHost(resolveEffectiveRequestHost(request)));
  const readTenantAccess = input.dependencies?.readTenantAccess ?? readConfiguredPluginTenantAccess;
  const resolvePermissions = input.dependencies?.resolvePermissions ?? resolveEffectivePermissions;
  const resolveResourceCapability = input.dependencies?.resolveResourceCapability;
  const validateRequestCsrf = input.dependencies?.validateCsrf ?? validateCsrf;
  const translate = resolveTranslation(input.dependencies);
  const descriptors = [...input.descriptors.values()];

  return async (request) => {
    const path = normalizePath(new URL(request.url).pathname);
    const pathDescriptors = descriptors.filter((descriptor) => descriptor.path === path);
    if (pathDescriptors.length === 0) return null;
    const descriptor = pathDescriptors.find((entry) => entry.method === request.method);
    if (!descriptor) {
      return new Response(null, {
        status: 405,
        headers: {
          Allow: pathDescriptors
            .map((entry) => entry.method)
            .sort()
            .join(', '),
        },
      });
    }
    const handler = input.handlers[descriptor.id];
    if (!handler) {
      throw new Error(`missing_plugin_server_handler:${descriptor.id}`);
    }

    return authenticate(request, async (context) => {
      if (MUTATING_METHODS.has(descriptor.method)) {
        const csrfError = validateRequestCsrf(request, getWorkspaceContext().requestId);
        if (csrfError) return csrfError;
      }

      const requirement = descriptor.accessRequirement;
      if (requirement.kind === 'platform') {
        if (
          !isPlatformHost(request) ||
          !satisfiesSet(requirement.roles, new Set(context.user.roles))
        ) {
          return createError(request, translate, 403, 'forbidden', 'platformPermissionDenied');
        }
      } else if (requirement.kind === 'tenant') {
        const accessError = await authorizeTenantHandler({
          context,
          descriptor,
          readTenantAccess,
          resolvePermissions,
          resolveResourceCapability,
          request,
          translate,
        });
        if (accessError) return accessError;
      } else {
        return createError(request, translate, 403, 'forbidden', 'unsupportedScope');
      }

      return handler({
        request,
        pluginId: descriptor.ownerPluginId,
        handlerId: descriptor.id,
        scope: requirement.kind,
        ...(context.activeOrganizationId
          ? { activeOrganizationId: context.activeOrganizationId }
          : {}),
        actor: {
          id: context.user.id,
          roles: context.user.roles,
          ...(context.user.instanceId ? { instanceId: context.user.instanceId } : {}),
        },
      });
    });
  };
};
