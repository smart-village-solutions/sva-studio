import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';
import type { OrganizationMainserverCredentialState } from './organization-mainserver-credentials.js';
import { createOrganizationHandler } from './organization-mutation-create.js';
import { createOrganizationContextHandler } from './organization-mutation-context.js';
import { createOrganizationMembershipAssignHandler } from './organization-mutation-membership-assign.js';
import { createOrganizationMembershipRemoveHandler } from './organization-mutation-membership-remove.js';
import { createOrganizationMembershipUpdateHandler } from './organization-mutation-membership.js';
import { createOrganizationUpdateHandlers } from './organization-mutation-update.js';
import type { QueryClient } from './query-client.js';
import type { IdempotencyReserveResult } from './types.js';

export type OrganizationMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type OrganizationMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type PreparedOrganizationMutationActor = OrganizationMutationActor & {
  readonly actorAccountId: string;
};

type ParseRequestBodyResult<TData> =
  { readonly ok: true; readonly data: TData; readonly rawBody: string } | { readonly ok: false };

type HierarchyResolution =
  | { readonly ok: true; readonly hierarchyPath: readonly string[]; readonly depth: number }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: ApiErrorCode;
      readonly message: string;
    };

type OrganizationRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly is_active: boolean;
  readonly parent_organization_id: string | null;
  readonly hierarchy_path: readonly string[] | null;
  readonly depth: number;
  readonly child_count: number;
  readonly membership_count: number;
};

export type OrganizationMutationHandlerDeps<TFeatureFlags = unknown> = {
  readonly afterOrganizationCreated?: (input: {
    readonly actor: PreparedOrganizationMutationActor;
    readonly actorSubject: string;
    readonly organization: unknown;
  }) => Promise<unknown | undefined>;
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly completeIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }) => Promise<void>;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'write';
    readonly requestId?: string;
  }) => Response | null;
  readonly createActorResolutionDetails: (input: {
    readonly actorResolution: 'missing_actor_account';
    readonly instanceId: string;
  }) => Readonly<Record<string, unknown>>;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly subjectId?: string;
      readonly eventType:
        | 'organization.created'
        | 'organization.updated'
        | 'organization.deleted'
        | 'organization.membership_assigned'
        | 'organization.membership_removed'
        | 'organization.membership_updated'
        | 'organization.context_switched';
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin' | 'iam_ui',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly isHierarchyError: (
    value: unknown
  ) => value is Extract<HierarchyResolution, { readonly ok: false }>;
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly authorizeOrganizationMutationAccess?: (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext,
    requestId?: string
  ) => Promise<Response | null> | Response | null;
  readonly loadContextOptions: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly accountId: string }
  ) => Promise<
    readonly {
      readonly organizationId: string;
      readonly organizationKey: string;
      readonly isActive: boolean;
    }[]
  >;
  readonly loadOrganizationById: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<OrganizationRow | undefined>;
  readonly loadOrganizationDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<unknown | undefined>;
  readonly logger: {
    readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject?: string;
      readonly trigger:
        | 'organization_membership_assigned'
        | 'organization_membership_removed'
        | 'organization_membership_updated'
        | 'organization_context_switched';
    }
  ) => Promise<void>;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodType<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly randomUUID: () => string;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly rebuildOrganizationSubtree: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<void>;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoles: (
    ctx: OrganizationMutationAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveActorInfo: (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext,
    options: {
      readonly requireActorMembership: true;
      readonly provisionMissingActorMembership: true;
    }
  ) => Promise<{ readonly actor: OrganizationMutationActor } | { readonly error: Response }>;
  readonly resolveHierarchyFields: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly organizationId?: string;
      readonly parentOrganizationId?: string | null;
    }
  ) => Promise<HierarchyResolution>;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly upsertOrganizationMainserverCredentials: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly organizationId: string;
      readonly actorAccountId?: string;
      readonly mainserverApplicationId?: string;
      readonly mainserverApplicationSecret?: string;
    }
  ) => Promise<OrganizationMainserverCredentialState>;
  readonly updateSession: (
    sessionId: string,
    patch: { readonly activeOrganizationId?: string }
  ) => Promise<void>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export const createOrganizationMutationHandlers = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const { createOrganizationInternal } = createOrganizationHandler(deps);
  const { updateOrganizationInternal, deleteOrganizationInternal } =
    createOrganizationUpdateHandlers(deps);
  const { assignOrganizationMembershipInternal } = createOrganizationMembershipAssignHandler(deps);
  const { removeOrganizationMembershipInternal } = createOrganizationMembershipRemoveHandler(deps);
  const { updateOrganizationMembershipInternal } = createOrganizationMembershipUpdateHandler(deps);
  const { updateMyOrganizationContextInternal } = createOrganizationContextHandler(deps);
  return {
    assignOrganizationMembershipInternal,
    createOrganizationInternal,
    deleteOrganizationInternal,
    removeOrganizationMembershipInternal,
    updateOrganizationMembershipInternal,
    updateMyOrganizationContextInternal,
    updateOrganizationInternal,
  };
};
