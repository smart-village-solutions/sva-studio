import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
import { createMutationWorkflow } from '@sva/server-runtime';
import { getRoleDisplayName, getRoleExternalName } from './role-audit.js';
import { isTenantTechnicalKeycloakRole } from './role-governance.js';
import {
  persistLocalRoleUpdate,
  redirectRoleSyncRetryToReconcile,
  syncTechnicalRoleUpdate,
  type PreparedRoleUpdate,
} from './role-update-sync.js';

export type UpdateRoleAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type UpdateRoleActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type MutableRoleShape = {
  readonly role_key: string;
  readonly display_name?: string | null;
  readonly external_role_name?: string | null;
  readonly role_name: string;
  readonly description: string | null;
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
};

export type UpdateRolePayloadShape = {
  readonly displayName?: string;
  readonly description?: string | null;
  readonly roleLevel?: number;
  readonly permissionIds?: readonly string[];
  readonly permissionAssignments?: readonly {
    readonly permissionId: string;
    readonly accessScope?: IamRolePermissionAssignmentScope;
  }[];
  readonly retrySync?: boolean;
};

export type UpdateRoleIdentityProvider<TAttributes = unknown> = {
  readonly provider: {
    readonly updateRole: (
      externalName: string,
      input: { readonly description?: string; readonly attributes: TAttributes }
    ) => Promise<unknown>;
  };
};

const getKeycloakRoleNameForMutation = (role: MutableRoleShape): string =>
  isTenantTechnicalKeycloakRole(role) ? role.role_key : getRoleExternalName(role);

export type ParsedUpdateRoleBody<TPayload extends UpdateRolePayloadShape> =
  | { readonly ok: true; readonly data: TPayload; readonly rawBody: string }
  | { readonly ok: false };

type ParsedUpdateRoleSuccess<TPayload extends UpdateRolePayloadShape> = Extract<
  ParsedUpdateRoleBody<TPayload>,
  { readonly ok: true }
>;

export type UpdateRoleHandlerDeps<
  TPayload extends UpdateRolePayloadShape = UpdateRolePayloadShape,
  TAttributes = unknown,
  TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes> = UpdateRoleIdentityProvider<TAttributes>,
  TRole extends MutableRoleShape = MutableRoleShape,
  TRoleItem = unknown,
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
    readonly roleId?: string;
  }) => Response;
  readonly createApiError: (
    status: number,
    code: 'conflict' | 'internal_error' | 'invalid_request' | 'not_found',
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly iamRoleSyncCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly mapRoleSyncErrorCode: (error: unknown) => string;
  readonly markRoleSyncState: (input: {
    readonly actor: UpdateRoleActor;
    readonly roleId: string;
    readonly operation: 'update' | 'retry';
    readonly result: 'success' | 'failure';
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly errorCode?: string;
    readonly syncState: 'pending' | 'failed' | 'synced';
    readonly syncedAt?: boolean;
  }) => Promise<void>;
  readonly parseUpdateRoleBody: (request: Request) => Promise<ParsedUpdateRoleBody<TPayload>>;
  readonly persistUpdatedRole: (input: {
    readonly actor: UpdateRoleActor;
    readonly roleId: string;
    readonly existing: TRole;
    readonly displayName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly externalRoleName: string;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly {
      readonly permissionId: string;
      readonly accessScope?: IamRolePermissionAssignmentScope;
    }[];
    readonly operation: 'update' | 'retry';
  }) => Promise<TRoleItem>;
  readonly requireRoleId: (request: Request, requestId?: string) => string | Response;
  readonly requireRoleIdentityProvider: (instanceId: string, requestId?: string) => Promise<TIdentityProvider | Response>;
  readonly resolveMutableRole: (actor: UpdateRoleActor, roleId: string) => Promise<TRole | Response>;
  readonly resolveRoleMutationActor: (request: Request, ctx: UpdateRoleAuthenticatedRequestContext) => Promise<{ readonly actor: UpdateRoleActor } | { readonly response: Response }>;
  readonly sanitizeRoleErrorMessage: (error: unknown) => string;
  readonly trackKeycloakCall: <T>(operation: 'update_role' | 'update_role_compensation', work: () => Promise<T>) => Promise<T>;
  readonly validateRequestedPermissions?: (input: {
    readonly actor: UpdateRoleActor;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly {
      readonly permissionId: string;
      readonly accessScope?: IamRolePermissionAssignmentScope;
    }[];
  }) => Promise<Response | null>;
};

export const createUpdateRoleHandlerInternal =
  <
    TPayload extends UpdateRolePayloadShape,
    TAttributes,
    TIdentityProvider extends UpdateRoleIdentityProvider<TAttributes>,
    TRole extends MutableRoleShape,
    TRoleItem,
  >(
    deps: UpdateRoleHandlerDeps<TPayload, TAttributes, TIdentityProvider, TRole, TRoleItem>
  ) =>
  createMutationWorkflow<
    UpdateRoleAuthenticatedRequestContext,
    {
      readonly actor: UpdateRoleActor;
      readonly roleId: string;
    },
    Record<never, never>,
    Record<never, never>,
    ParsedUpdateRoleSuccess<TPayload>,
    Response
  >({
    prepare: async ({ request, context }) => {
      const resolvedActor = await deps.resolveRoleMutationActor(request, context);
      if ('response' in resolvedActor) {
        return resolvedActor.response;
      }

      const roleId = deps.requireRoleId(request, resolvedActor.actor.requestId);
      return roleId instanceof Response ? roleId : { actor: resolvedActor.actor, roleId };
    },
    authorize: async () => ({}),
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseUpdateRoleBody(request);
      if (!parsed.ok) {
        return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
      }
      if (parsed.data.retrySync) {
        return redirectRoleSyncRetryToReconcile(deps, actor.requestId);
      }

      const permissionValidationResponse = await deps.validateRequestedPermissions?.({
        actor,
        permissionIds: parsed.data.permissionIds,
        permissionAssignments: parsed.data.permissionAssignments,
      });
      return permissionValidationResponse ?? parsed;
    },
    execute: async ({ actor, roleId, input: parsed }) => {
      const existing = await deps.resolveMutableRole(actor, roleId);
      if (existing instanceof Response) {
        return existing;
      }

      const preparedUpdate = {
        actor,
        roleId,
        existing,
        data: parsed.data,
        operation: 'update',
        displayName: parsed.data.displayName?.trim() || getRoleDisplayName(existing),
        description: parsed.data.description ?? existing.description ?? undefined,
        roleLevel: parsed.data.roleLevel ?? existing.role_level,
        externalRoleName: getKeycloakRoleNameForMutation(existing),
      } satisfies PreparedRoleUpdate<TPayload, TRole>;

      if (!isTenantTechnicalKeycloakRole(existing)) {
        return persistLocalRoleUpdate(deps, preparedUpdate);
      }
      return syncTechnicalRoleUpdate(deps, preparedUpdate);
    },
    mapError: (_error, state) =>
      deps.createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', state.actor.requestId),
    respond: (response) => response,
  });
