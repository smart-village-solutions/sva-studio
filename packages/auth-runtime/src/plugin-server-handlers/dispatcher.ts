import {
  evaluateAuthorizeDecision,
  evaluateUiAccess,
  type EffectivePermission,
  type UiResourceCapability,
} from '@sva/iam-core';
import { createPermissionDenialDetailsForAction } from '@sva/core';
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
  PluginTechnicalServiceTenantContext,
} from '@sva/plugin-sdk';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import { translatePluginTenantLifecycleMessage } from '../plugin-tenant-lifecycle/messages.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  translatePluginServerHandlerMessage,
  type PluginServerHandlerMessageKey,
} from './messages.js';
import { authorizePluginPlatformHandler } from './platform-authorization.js';
import { dispatchPluginServiceHandler } from './service-execution.js';

type EffectivePermissionsResolution = Awaited<ReturnType<typeof resolveEffectivePermissions>>;

export type PluginServiceAuthenticationResult =
  | Readonly<{ kind: 'authenticated'; subject: string }>
  | Readonly<{ kind: 'rejected'; response: Response }>;

export type PluginServiceTenantBindingResult =
  | Readonly<{ kind: 'bound'; tenant: PluginTechnicalServiceTenantContext }>
  | Readonly<{ kind: 'rejected'; response: Response }>;

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
  authenticateService?: (input: {
    readonly request: Request;
    readonly descriptor: PluginServerHandlerRegistryEntry;
    readonly serviceId: string;
  }) => Promise<PluginServiceAuthenticationResult>;
  bindServiceTenant?: (input: {
    readonly request: Request;
    readonly descriptor: PluginServerHandlerRegistryEntry;
    readonly serviceId: string;
    readonly serviceSubject: string;
    readonly tenantHeaderName: string;
  }) => Promise<PluginServiceTenantBindingResult>;
  observeServiceResponse?: (input: {
    readonly request: Request;
    readonly descriptor: PluginServerHandlerRegistryEntry;
    readonly tenant: PluginTechnicalServiceTenantContext;
    readonly response: Response;
    readonly durationMs: number;
  }) => Promise<void> | void;
}>;

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (trimmed === '/') return trimmed;
  return trimmed.replace(/\/+$/, '');
};

const pathSegments = (path: string): readonly string[] => path.split('/').filter(Boolean);

const endpointShape = (path: string): string =>
  '/' +
  pathSegments(path)
    .map((segment) => (segment.startsWith('$') ? '$' : segment))
    .join('/');

const staticSegmentCount = (path: string): number =>
  pathSegments(path).filter((segment) => !segment.startsWith('$')).length;

const pathsOverlap = (left: string, right: string): boolean => {
  const leftSegments = pathSegments(left);
  const rightSegments = pathSegments(right);
  return leftSegments.length === rightSegments.length && leftSegments.every((segment, index) => {
    const counterpart = rightSegments[index];
    return segment === counterpart || segment.startsWith('$') || counterpart?.startsWith('$');
  });
};

const matchPath = (
  template: string,
  path: string
): Readonly<Record<string, string>> | null => {
  const templateSegments = pathSegments(template);
  const requestSegments = pathSegments(path);
  if (templateSegments.length !== requestSegments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const expected = templateSegments[index];
    const actual = requestSegments[index];
    if (!expected || !actual) return null;
    if (expected.startsWith('$')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

const isCollectionCapablePermission = (permission: EffectivePermission): boolean =>
  permission.accessScope !== 'own' &&
  permission.resourceId === undefined &&
  permission.geoScope === undefined &&
  (permission.scope === undefined || Object.keys(permission.scope).length === 0);

const isDomainHandler = (descriptor: PluginServerHandlerRegistryEntry): boolean =>
  descriptor.path.startsWith(`/api/v1/${descriptor.ownerPluginId}/`);

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
  if (isDomainHandler(input.descriptor)) {
    if (!instanceId?.trim()) {
      return createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getWorkspaceContext().requestId);
    }
    if (requirement.moduleId !== input.descriptor.ownerPluginId) {
      return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
    }
    const tenantAccess = await input.readTenantAccess(instanceId, input.descriptor.ownerPluginId);
    if (!tenantAccess.allowed) {
      return createApiError(
        409,
        'plugin_tenant_access_blocked',
        translatePluginTenantLifecycleMessage(input.request, 'pluginAccessBlocked'),
        getWorkspaceContext().requestId,
        { reason_code: tenantAccess.reason }
      );
    }
    let resolved: EffectivePermissionsResolution;
    try {
      resolved = await input.resolvePermissions({
        instanceId,
        keycloakSubject: input.context.user.id,
      });
    } catch {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', getWorkspaceContext().requestId);
    }
    if (!resolved.ok) {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', getWorkspaceContext().requestId);
    }
    const decisions = requirement.actions.values.map((action) => ({
      action,
      decision: evaluateAuthorizeDecision(
        {
          instanceId,
          action,
          resource: { type: input.descriptor.ownerPluginId },
          context: { requestId: getWorkspaceContext().requestId },
        },
        resolved.permissions
      ),
    }));
    const allowed = requirement.actions.mode === 'allOf'
      ? decisions.every(({ decision }) => decision.allowed)
      : decisions.some(({ decision }) => decision.allowed);
    if (allowed) return null;
    const denied = decisions.find(({ decision }) => !decision.allowed);
    if (!denied) return createError(input.request, input.translate, 403, 'forbidden', 'permissionDenied');
    return createApiError(
      403,
      'forbidden',
      'Keine Berechtigung für diese Waste-Management-Operation.',
      getWorkspaceContext().requestId,
      {
        ...createPermissionDenialDetailsForAction(denied.action, denied.decision.reason),
        action: denied.action,
        reason_code: denied.decision.reason,
      }
    );
  }
  if (!instanceId || requirement.moduleId !== input.descriptor.ownerPluginId) {
    return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
  }
  const tenantAccess = await input.readTenantAccess(instanceId, input.descriptor.ownerPluginId);
  if (!tenantAccess.allowed) {
    return createError(input.request, input.translate, 403, 'forbidden', 'pluginUnavailable');
  }
  if (requirement.resourceContext === 'collection' && !input.context.activeOrganizationId) {
    return createError(input.request, input.translate, 403, 'forbidden', 'invalidInstanceContext');
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
  const effectivePermissions =
    requirement.resourceContext === 'collection'
      ? resolved.permissions.filter(isCollectionCapablePermission)
      : resolved.permissions;
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
      permissions: effectivePermissions as readonly EffectivePermission[],
    },
  });
  return decision.status === 'allowed'
    ? null
    : createError(input.request, input.translate, 403, 'forbidden', 'permissionDenied');
};

export const assertPluginServerHandlerCoverage = (input: {
  readonly descriptors: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly handlers: Readonly<Record<string, PluginServerExecutionHandler>>;
  readonly reservedPaths?: readonly string[];
}): void => {
  const endpoints = new Map<string, string>();
  const examined: PluginServerHandlerRegistryEntry[] = [];
  for (const descriptor of input.descriptors.values()) {
    const reservedPath = input.reservedPaths?.find((path) => pathsOverlap(path, descriptor.path));
    if (reservedPath) {
      throw new Error(`plugin_server_endpoint_conflicts_with_host:${descriptor.id}:${reservedPath}`);
    }
    const endpointKey = `${descriptor.method} ${endpointShape(descriptor.path)}`;
    const existingHandlerId = endpoints.get(endpointKey);
    if (existingHandlerId) {
      throw new Error(
        `duplicate_plugin_server_endpoint:${endpointKey}:${existingHandlerId}:${descriptor.id}`
      );
    }
    const ambiguous = examined.find((entry) =>
      entry.method === descriptor.method &&
      staticSegmentCount(entry.path) === staticSegmentCount(descriptor.path) &&
      pathsOverlap(entry.path, descriptor.path)
    );
    if (ambiguous) {
      throw new Error(
        `ambiguous_plugin_server_endpoint:${descriptor.method}:${ambiguous.id}:${descriptor.id}`
      );
    }
    endpoints.set(endpointKey, descriptor.id);
    examined.push(descriptor);
  }
  const declared = [...input.descriptors.keys()].sort((left, right) => left.localeCompare(right));
  const registered = Object.keys(input.handlers).sort((left, right) => left.localeCompare(right));
  const missing = declared.filter((handlerId) => !registered.includes(handlerId));
  if (missing.length > 0) {
    throw new Error(`missing_plugin_server_handlers:${missing.join(',')}`);
  }
  const unknown = registered.filter((handlerId) => !declared.includes(handlerId));
  if (unknown.length > 0) {
    throw new Error(`unknown_plugin_server_handlers:${unknown.join(',')}`);
  }
};

export const createPluginServerHandlerDispatcher = (input: {
  readonly descriptors: ReadonlyMap<string, PluginServerHandlerRegistryEntry>;
  readonly handlers: Readonly<Record<string, PluginServerExecutionHandler>>;
  readonly reservedPaths?: readonly string[];
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
  const descriptors = [...input.descriptors.values()].sort((left, right) => {
    return staticSegmentCount(right.path) - staticSegmentCount(left.path);
  });

  return async (request) => {
    const path = normalizePath(new URL(request.url).pathname);
    const pathDescriptors = descriptors.flatMap((descriptor) => {
      const pathParams = matchPath(descriptor.path, path);
      return pathParams ? [{ descriptor, pathParams }] : [];
    });
    if (pathDescriptors.length === 0) return null;
    const mostSpecificPath = pathDescriptors[0]?.descriptor.path;
    const selectedPathDescriptors = pathDescriptors.filter(
      ({ descriptor }) => descriptor.path === mostSpecificPath
    );
    const selected = selectedPathDescriptors.find(({ descriptor }) => descriptor.method === request.method);
    if (!selected) {
      const allow = selectedPathDescriptors
        .map(({ descriptor }) => descriptor.method)
        .sort((left, right) => left.localeCompare(right))
        .join(', ');
      if (selectedPathDescriptors.some(({ descriptor }) => isDomainHandler(descriptor))) {
        const requestId = getWorkspaceContext().requestId;
        return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'HTTP-Methode nicht erlaubt.', ...(requestId ? { requestId } : {}) }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', Allow: allow, ...(requestId ? { 'X-Request-Id': requestId } : {}) },
        });
      }
      return new Response(null, {
        status: 405,
        headers: {
          Allow: allow,
        },
      });
    }
    const { descriptor, pathParams } = selected;
    const handler = input.handlers[descriptor.id];
    if (!handler) {
      throw new Error(`missing_plugin_server_handler:${descriptor.id}`);
    }

    if (descriptor.accessRequirement.kind === 'service') {
      return dispatchPluginServiceHandler({
        request,
        descriptor,
        handler,
        serviceId: descriptor.accessRequirement.serviceId,
        tenantHeaderName: descriptor.accessRequirement.tenantBinding.headerName,
        dependencies: input.dependencies,
      });
    }

    return authenticate(request, async (context) => {
      if (MUTATING_METHODS.has(descriptor.method)) {
        const csrfError = validateRequestCsrf(request, getWorkspaceContext().requestId);
        if (csrfError) return csrfError;
      }

      const requirement = descriptor.accessRequirement;
      if (requirement.kind === 'platform') {
        const accessError = authorizePluginPlatformHandler({
          request,
          requirement,
          roles: context.user.roles,
          isPlatformHost,
          translate,
        });
        if (accessError) return accessError;
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
        pathParams,
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
