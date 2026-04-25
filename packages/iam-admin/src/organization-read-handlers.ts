import type {
  IamOrganizationContext,
  IamOrganizationContextOption,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationType,
} from '@sva/core';
import type { ApiErrorCode } from '@sva/core';

import type { QueryClient } from './query-client.js';

export type OrganizationReadAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type OrganizationReadActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
};

export type OrganizationReadHandlerDeps<TFeatureFlags = unknown> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly asApiList: (
    data: readonly unknown[],
    pagination: { readonly page: number; readonly pageSize: number; readonly total: number },
    requestId?: string
  ) => unknown;
  readonly chooseActiveOrganizationId: (input: {
    readonly storedActiveOrganizationId?: string;
    readonly organizations: readonly IamOrganizationContextOption[];
  }) => string | undefined;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'read';
    readonly requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin' | 'iam_ui',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getSession: (sessionId: string) => Promise<{ readonly activeOrganizationId?: string } | undefined>;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly loadContextOptions: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly accountId: string }
  ) => Promise<readonly IamOrganizationContextOption[]>;
  readonly loadOrganizationDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<IamOrganizationDetail | undefined>;
  readonly loadOrganizationList: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly page: number;
      readonly pageSize: number;
      readonly search?: string;
      readonly organizationType?: IamOrganizationType;
      readonly isActive?: boolean;
    }
  ) => Promise<{ readonly items: readonly IamOrganizationListItem[]; readonly total: number }>;
  readonly readOrganizationTypeFilter: (request: Request) => IamOrganizationType | undefined | 'invalid';
  readonly readPage: (request: Request) => { readonly page: number; readonly pageSize: number };
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly readStatusFilter: (request: Request) => boolean | undefined;
  readonly readString: (value: unknown) => string | undefined;
  readonly requireRoles: (
    ctx: OrganizationReadAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: OrganizationReadAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: OrganizationReadActor } | { readonly error: Response }>;
  readonly updateSession: (sessionId: string, patch: { readonly activeOrganizationId?: string }) => Promise<void>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);

const prepareOrganizationReadRequest = async <TFeatureFlags>(
  deps: OrganizationReadHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: OrganizationReadAuthenticatedRequestContext
): Promise<{ readonly actor: OrganizationReadActor } | { readonly error: Response }> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }
  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution;
  }

  const rateLimit = deps.consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  return actorResolution;
};

export const createOrganizationReadHandlers = <TFeatureFlags>(
  deps: OrganizationReadHandlerDeps<TFeatureFlags>
) => {
  const listOrganizationsInternal = async (
    request: Request,
    ctx: OrganizationReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareOrganizationReadRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    const { page, pageSize } = deps.readPage(request);
    const url = new URL(request.url);
    const search = deps.readString(url.searchParams.get('search'));
    const organizationType = deps.readOrganizationTypeFilter(request);
    if (organizationType === 'invalid') {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger organizationType-Filter.', actorResolution.actor.requestId);
    }
    const isActive = deps.readStatusFilter(request);

    try {
      const organizations = await deps.withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
        deps.loadOrganizationList(client, {
          instanceId: actorResolution.actor.instanceId,
          page,
          pageSize,
          search,
          organizationType,
          isActive,
        })
      );

      return deps.jsonResponse(
        200,
        deps.asApiList(organizations.items, { page, pageSize, total: organizations.total }, actorResolution.actor.requestId)
      );
    } catch {
      return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
    }
  };

  const getOrganizationInternal = async (
    request: Request,
    ctx: OrganizationReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareOrganizationReadRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }

    const organizationId = deps.readPathSegment(request, 4);
    if (!organizationId || !deps.isUuid(organizationId)) {
      return deps.createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
    }

    try {
      const organization = await deps.withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
        deps.loadOrganizationDetail(client, { instanceId: actorResolution.actor.instanceId, organizationId })
      );

      if (!organization) {
        return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actorResolution.actor.requestId);
      }

      return deps.jsonResponse(200, deps.asApiItem(organization, actorResolution.actor.requestId));
    } catch {
      return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
    }
  };

  const getMyOrganizationContextInternal = async (
    request: Request,
    ctx: OrganizationReadAuthenticatedRequestContext
  ): Promise<Response> => {
    const requestContext = deps.getWorkspaceContext();
    const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_ui', requestContext.requestId);
    if (featureCheck) {
      return featureCheck;
    }

    const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    if (!actorResolution.actor.actorAccountId) {
      return deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
    }
    const actorAccountId = actorResolution.actor.actorAccountId;

    try {
      const organizations = await deps.withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
        deps.loadContextOptions(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorAccountId,
        })
      );
      const session = await deps.getSession(ctx.sessionId);
      const activeOrganizationId = deps.chooseActiveOrganizationId({
        storedActiveOrganizationId: session?.activeOrganizationId,
        organizations,
      });

      if (session && session.activeOrganizationId !== activeOrganizationId) {
        await deps.updateSession(ctx.sessionId, { activeOrganizationId });
      }

      const response: IamOrganizationContext = {
        activeOrganizationId,
        organizations,
      };

      return deps.jsonResponse(200, deps.asApiItem(response, actorResolution.actor.requestId));
    } catch {
      return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
    }
  };

  return {
    getMyOrganizationContextInternal,
    getOrganizationInternal,
    listOrganizationsInternal,
  };
};
