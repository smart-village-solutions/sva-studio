import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
import { createMutationWorkflow } from '@sva/server-runtime';

import { isTenantTechnicalKeycloakRole } from './role-governance.js';
import { persistLocalRoleCreate, reserveCreateRoleIdempotency, syncTechnicalRoleCreate, type PreparedRoleCreate } from './role-create-sync.js';
import type { IdempotencyReserveResult } from './types.js';

export type CreateRoleAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type CreateRoleActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type CreateRolePayloadShape = {
  readonly roleName: string;
  readonly displayName?: string;
  readonly description?: string | null;
  readonly roleLevel: number;
  readonly permissionIds: readonly string[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
};

export type CreateRoleIdentityProvider<TAttributes = unknown> = {
  readonly provider: {
    readonly createRole: (input: {
      readonly externalName: string;
      readonly description?: string;
      readonly attributes: TAttributes;
    }) => Promise<unknown>;
    readonly deleteRole: (externalName: string) => Promise<void>;
  };
};

export type ParsedCreateRoleBody<TPayload extends CreateRolePayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

type ParsedCreateRoleSuccess<TPayload extends CreateRolePayloadShape> = Extract<
  ParsedCreateRoleBody<TPayload>,
  { readonly ok: true }
>;

export type CreateRoleHandlerDeps<
  TPayload extends CreateRolePayloadShape = CreateRolePayloadShape,
  TAttributes = unknown,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes> = CreateRoleIdentityProvider<TAttributes>,
  TRole = unknown,
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly buildRoleAttributes: (input: {
    readonly instanceId: string;
    readonly roleKey: string;
    readonly displayName: string;
  }) => TAttributes;
  readonly buildRoleSyncFailure: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly fallbackMessage: string;
  }) => Response;
  readonly completeIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }) => Promise<void>;
  readonly createApiError: (
    status: number,
    code: 'conflict' | 'idempotency_key_reuse' | 'internal_error' | 'invalid_request' | 'keycloak_unavailable',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly iamRoleSyncCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly parseCreateRoleBody: (request: Request) => Promise<ParsedCreateRoleBody<TPayload>>;
  readonly persistCreatedRole: (input: {
    readonly actor: CreateRoleActor;
    readonly roleKey: string;
    readonly displayName: string;
    readonly externalRoleName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly permissionIds: readonly string[];
    readonly permissionAssignments?: readonly {
      readonly permissionId: string;
      readonly accessScope?: IamRolePermissionAssignmentScope;
    }[];
  }) => Promise<TRole>;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoleIdentityProvider: (
    instanceId: string,
    requestId?: string
  ) => Promise<TIdentityProvider | Response>;
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveRoleMutationActor: (
    request: Request,
    ctx: CreateRoleAuthenticatedRequestContext
  ) => Promise<{ readonly actor: CreateRoleActor } | { readonly response: Response }>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly trackKeycloakCall: <T>(
    operation: 'create_role' | 'delete_role_compensation',
    work: () => Promise<T>
  ) => Promise<T>;
  readonly validateRequestedPermissions?: (input: {
    readonly actor: CreateRoleActor;
    readonly permissionIds: readonly string[];
    readonly permissionAssignments?: readonly {
      readonly permissionId: string;
      readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
  }) => Promise<Response | null>;
};

const parseCreateRoleRequest = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  request: Request,
  actor: CreateRoleActor
): Promise<ParsedCreateRoleSuccess<TPayload> | Response> => {
  const parsed = await deps.parseCreateRoleBody(request);
  return parsed.ok ? parsed : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
};

const validateCreateRolePermissions = async <
  TPayload extends CreateRolePayloadShape,
  TAttributes,
  TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
  TRole,
>(
  deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>,
  actor: CreateRoleActor,
  data: TPayload
): Promise<Response | null> =>
  deps.validateRequestedPermissions?.({
    actor,
    permissionIds: data.permissionIds,
    permissionAssignments: data.permissionAssignments,
  }) ?? null;

export const createCreateRoleHandlerInternal =
  <
    TPayload extends CreateRolePayloadShape,
    TAttributes,
    TIdentityProvider extends CreateRoleIdentityProvider<TAttributes>,
    TRole,
  >(
    deps: CreateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole>
  ) =>
  createMutationWorkflow<
    CreateRoleAuthenticatedRequestContext,
    {
      readonly actor: CreateRoleActor;
    },
    Record<never, never>,
    {
      readonly idempotencyKey: string;
    },
    ParsedCreateRoleSuccess<TPayload>,
    Response
  >({
    prepare: async ({ request, context }) => {
      const resolvedActor = await deps.resolveRoleMutationActor(request, context);
      return 'response' in resolvedActor ? resolvedActor.response : { actor: resolvedActor.actor };
    },
    authorize: async () => ({}),
    idempotency: ({ request, actor }) => {
      const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
      return 'error' in idempotencyKey ? idempotencyKey.error : { idempotencyKey: idempotencyKey.key };
    },
    parse: async ({ request, actor }) => {
      const parsed = await parseCreateRoleRequest(deps, request, actor);
      if (parsed instanceof Response) {
        return parsed;
      }

      const permissionValidationResponse = await validateCreateRolePermissions(deps, actor, parsed.data);
      return permissionValidationResponse ?? parsed;
    },
    execute: async ({ actor, idempotencyKey, input: parsed }) => {
      const reservedResponse = await reserveCreateRoleIdempotency(deps, {
        actor,
        idempotencyKey,
        rawBody: parsed.rawBody,
      });
      if (reservedResponse) {
        return reservedResponse;
      }

      const roleKey = parsed.data.roleName;
      const displayName = parsed.data.displayName?.trim() || roleKey;
      const externalRoleName = roleKey;
      const preparedCreate = {
        actor,
        data: parsed.data,
        displayName,
        externalRoleName,
        idempotencyKey,
        roleKey,
      } satisfies PreparedRoleCreate<TPayload>;

      return isTenantTechnicalKeycloakRole({ role_key: roleKey, external_role_name: externalRoleName })
        ? syncTechnicalRoleCreate(deps, preparedCreate)
        : persistLocalRoleCreate(deps, preparedCreate);
    },
    mapError: (_error, state) =>
      deps.createApiError(500, 'internal_error', 'Rolle konnte nicht angelegt werden.', state.actor?.requestId),
    respond: (response) => response,
  });
