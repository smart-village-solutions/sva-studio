import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';

import type { QueryClient } from './query-client.js';
import type { IdempotencyReserveResult } from './types.js';
import { createLegacyGroupInternal } from './legacy-group-mutation-create.js';
import {
  updateLegacyGroupInternal,
  deleteLegacyGroupInternal,
} from './legacy-group-mutation-update.js';

export type LegacyGroupMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type LegacyGroupMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type LegacyGroupMutationPreparedActor = LegacyGroupMutationActor & {
  readonly actorAccountId: string;
};

type ParseRequestBodyResult<TData> =
  { readonly ok: true; readonly data: TData; readonly rawBody: string } | { readonly ok: false };

export type LegacyGroupMutationHandlerDeps<TFeatureFlags = unknown> = {
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
      readonly eventType: 'group.created' | 'group.updated' | 'group.deleted';
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly trigger: 'group_created' | 'group_updated' | 'group_deleted';
    }
  ) => Promise<void>;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodType<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoles: (
    ctx: LegacyGroupMutationAuthenticatedRequestContext,
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
    ctx: LegacyGroupMutationAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: LegacyGroupMutationActor } | { readonly error: Response }>;
  readonly resolveRolesByIds: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly roleIds: readonly string[] }
  ) => Promise<readonly unknown[]>;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export const createLegacyGroupMutationHandlers = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>
) => {
  const createGroupInternal = createLegacyGroupInternal(deps);
  const updateGroupInternal = updateLegacyGroupInternal(deps);
  const deleteGroupInternal = deleteLegacyGroupInternal(deps);
  return {
    createGroupInternal,
    deleteGroupInternal,
    updateGroupInternal,
  };
};
