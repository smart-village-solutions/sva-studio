import type { UiResourceCapability } from '@sva/iam-core';
import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
  PluginTechnicalServiceTenantContext,
} from '@sva/plugin-sdk';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';

import { createApiError } from '../api-error.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { withAuthenticatedUser } from '../middleware.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  translatePluginServerHandlerMessage,
  type PluginServerHandlerMessageKey,
} from './messages.js';
import { authorizePluginPlatformHandler } from './platform-authorization.js';
import { dispatchPluginServiceHandler } from './service-execution.js';
import { authorizeTenantHandler } from './tenant-authorization.js';
import {
  assertPluginServerHandlerCoverage,
  isDomainHandler,
  matchPath,
  normalizePath,
  staticSegmentCount,
} from './routes.js';

export { assertPluginServerHandlerCoverage } from './routes.js';

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
    const selected = selectedPathDescriptors.find(
      ({ descriptor }) => descriptor.method === request.method
    );
    if (!selected) {
      const allow = selectedPathDescriptors
        .map(({ descriptor }) => descriptor.method)
        .sort((left, right) => left.localeCompare(right))
        .join(', ');
      if (selectedPathDescriptors.some(({ descriptor }) => isDomainHandler(descriptor))) {
        const requestId = getWorkspaceContext().requestId;
        return new Response(
          JSON.stringify({
            error: 'method_not_allowed',
            message: 'HTTP-Methode nicht erlaubt.',
            ...(requestId ? { requestId } : {}),
          }),
          {
            status: 405,
            headers: {
              'Content-Type': 'application/json',
              Allow: allow,
              ...(requestId ? { 'X-Request-Id': requestId } : {}),
            },
          }
        );
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
        sessionId: context.sessionId,
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
          ...(context.user.email ? { email: context.user.email } : {}),
          ...(context.user.displayName ? { displayName: context.user.displayName } : {}),
        },
      });
    });
  };
};
