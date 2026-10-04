import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';

import type { GroupQueryClient } from './group-query.js';
import {
  createGroupInternal,
  updateGroupInternal,
  deleteGroupInternal,
} from './group-mutation-crud.js';
import { assignGroupRoleInternal, removeGroupRoleInternal } from './group-mutation-roles.js';
import {
  assignGroupMembershipInternal,
  removeGroupMembershipInternal,
} from './group-mutation-membership.js';

export type GroupMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type GroupMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type GroupMutationLogger = {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
};

type ParseRequestBodyResult<TData> =
  { readonly ok: true; readonly data: TData } | { readonly ok: false };

type GroupActivityEventType =
  | 'iam_group_created'
  | 'iam_group_updated'
  | 'iam_group_deleted'
  | 'iam_group_role_assigned'
  | 'iam_group_role_removed'
  | 'iam_group_member_added'
  | 'iam_group_member_removed';

type GroupEvent =
  | {
      readonly event: 'RolePermissionChanged';
      readonly instanceId: string;
      readonly roleId: string;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  | {
      readonly event: 'GroupMembershipChanged';
      readonly instanceId: string;
      readonly groupId: string;
      readonly accountId: string;
      readonly keycloakSubject?: string;
      readonly changeType: 'added' | 'removed';
      readonly requestId?: string;
      readonly traceId?: string;
    }
  | {
      readonly event: 'GroupDeleted';
      readonly instanceId: string;
      readonly groupId: string;
      readonly affectedAccountIds: readonly string[];
      readonly affectedKeycloakSubjects?: readonly string[];
      readonly requestId?: string;
      readonly traceId?: string;
    };

export type GroupMutationHandlerDeps = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly emitActivityLog: (
    client: GroupQueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly eventType: GroupActivityEventType;
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly getWorkspaceContext: () => { readonly requestId?: string; readonly traceId?: string };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: GroupMutationLogger;
  readonly authorizeGroupMutationAccess?: (
    request: Request,
    ctx: GroupMutationAuthenticatedRequestContext,
    requestId?: string
  ) => Promise<Response | null> | Response | null;
  readonly notifyPermissionInvalidation: (
    client: GroupQueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject?: string;
      readonly trigger: 'user_group_changed';
    }
  ) => Promise<void>;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodType<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly publishGroupEvent: (client: GroupQueryClient, event: GroupEvent) => Promise<void>;
  readonly randomUUID: () => string;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireRoles: (
    ctx: GroupMutationAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: GroupMutationAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: GroupMutationActor } | { readonly error: Response }>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: GroupQueryClient) => Promise<T>
  ) => Promise<T>;
};

export const createGroupMutationHandlers = (deps: GroupMutationHandlerDeps) => ({
  assignGroupMembershipInternal: assignGroupMembershipInternal(deps),
  assignGroupRoleInternal: assignGroupRoleInternal(deps),
  createGroupInternal: createGroupInternal(deps),
  deleteGroupInternal: deleteGroupInternal(deps),
  removeGroupMembershipInternal: removeGroupMembershipInternal(deps),
  removeGroupRoleInternal: removeGroupRoleInternal(deps),
  updateGroupInternal: updateGroupInternal(deps),
});
