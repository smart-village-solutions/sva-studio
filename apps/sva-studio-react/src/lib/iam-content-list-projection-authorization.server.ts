import type { IamContentAccessSummary, IamContentListItem } from '@sva/core';
import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/iam-core';
import {
  type AuthenticatedRequestContext,
  readMainserverScopeResolverMode,
  resolveActorAccountId,
  resolveEffectivePermissions,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createListErrorResponse,
  isMainserverContentType,
  type MainserverContentType,
} from './iam-content-list-api.shared.js';
import type { ProjectionReadVisibilityRule } from './iam-content-list-visibility.js';

const buildReadAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.read`
    : 'content.read';
const buildCreateAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.create`
    : 'content.create';
const buildUpdateAction = (contentType: string): string =>
  isMainserverContentType(contentType)
    ? `${contentType.split('.')[0] ?? 'content'}.update`
    : 'content.updateMetadata';

const optionalAuthorizeField = <TKey extends string, TValue>(
  key: TKey,
  value: TValue | undefined
): Partial<Record<TKey, TValue>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<TKey, TValue>>;

type ListAccessAuthorizeInput = Readonly<{
  instanceId: string;
  action: string;
  item: IamContentListItem;
  organizationId?: string;
  actorAccountId?: string;
}>;

const buildListAccessAuthorizeRequest = (input: ListAccessAuthorizeInput): AuthorizeRequest => {
  const workspaceContext = getWorkspaceContext();
  const includeCreatedBy = input.action === buildUpdateAction(input.item.contentType);
  return {
    instanceId: input.instanceId,
    action: input.action,
    resource: {
      type: input.action.split('.')[0] || 'content',
      ...optionalAuthorizeField('id', includeCreatedBy ? input.item.id : undefined),
      ...optionalAuthorizeField('organizationId', input.organizationId),
      attributes: {
        contentType: input.item.contentType,
        ...optionalAuthorizeField('organizationId', input.organizationId),
        ...optionalAuthorizeField(
          'ownerUserId',
          includeCreatedBy ? input.item.ownerUserId : undefined
        ),
        ...optionalAuthorizeField(
          'ownerOrganizationId',
          includeCreatedBy ? input.item.ownerOrganizationId : undefined
        ),
      },
    },
    context: {
      ...optionalAuthorizeField('organizationId', input.organizationId),
      ...optionalAuthorizeField('requestId', workspaceContext.requestId),
      ...optionalAuthorizeField('traceId', workspaceContext.traceId),
      attributes: {
        contentType: input.item.contentType,
        ...optionalAuthorizeField('actorAccountId', input.actorAccountId),
      },
    },
  };
};

const buildTypeAuthorizeRequest = (
  instanceId: string,
  contentType: string,
  organizationId: string | undefined
): AuthorizeRequest => {
  const action = buildReadAction(contentType);
  const workspaceContext = getWorkspaceContext();
  return {
    instanceId,
    action,
    resource: {
      type: action.split('.')[0] || 'content',
      ...(organizationId ? { organizationId } : {}),
      attributes: { contentType, ...(organizationId ? { organizationId } : {}) },
    },
    context: {
      ...(organizationId ? { organizationId } : {}),
      ...(workspaceContext.requestId ? { requestId: workspaceContext.requestId } : {}),
      ...(workspaceContext.traceId ? { traceId: workspaceContext.traceId } : {}),
      attributes: { contentType },
    },
  };
};

const hasDeferredRowScopedReadPermission = (
  permissions: readonly EffectivePermission[],
  contentType: string
): boolean => {
  const action = buildReadAction(contentType);
  const resourceType = action.split('.')[0] ?? 'content';
  return permissions.some(
    (permission) =>
      permission.action === action &&
      permission.resourceType === resourceType &&
      !permission.resourceId &&
      (permission.accessScope === 'own' || permission.accessScope === 'organization')
  );
};

export const authorizeRequestedTypes = async (
  ctx: AuthenticatedRequestContext,
  effectiveTypes: readonly string[]
): Promise<
  | {
      readonly allowedTypes: readonly string[];
      readonly permissions: readonly EffectivePermission[];
    }
  | Response
> => {
  const instanceId = ctx.user.instanceId;
  if (!instanceId) {
    return createListErrorResponse(
      400,
      'invalid_instance_id',
      'Kein Instanzkontext für diese Inhalte vorhanden.',
      getWorkspaceContext().requestId
    );
  }
  const resolvedPermissions = await resolveEffectivePermissions({
    instanceId,
    keycloakSubject: ctx.user.id,
    ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
  });
  if (!resolvedPermissions.ok) {
    return createListErrorResponse(
      503,
      'database_unavailable',
      'Berechtigungen konnten nicht geprüft werden.',
      getWorkspaceContext().requestId
    );
  }

  const allowedTypes: string[] = [];
  let sawForbidden = false;
  for (const contentType of effectiveTypes) {
    const decision = evaluateAuthorizeDecision(
      buildTypeAuthorizeRequest(instanceId, contentType, ctx.activeOrganizationId),
      resolvedPermissions.permissions
    );
    if (
      decision.allowed ||
      hasDeferredRowScopedReadPermission(resolvedPermissions.permissions, contentType)
    ) {
      allowedTypes.push(contentType);
    } else {
      sawForbidden = true;
    }
  }
  if (allowedTypes.length === 0 && sawForbidden) {
    return createListErrorResponse(
      403,
      'forbidden',
      'Keine Berechtigung für diese Inhalte.',
      getWorkspaceContext().requestId
    );
  }
  return { allowedTypes, permissions: resolvedPermissions.permissions };
};

const resolveItemAccess = (
  instanceId: string,
  activeOrganizationId: string | undefined,
  item: IamContentListItem,
  permissions: readonly EffectivePermission[],
  actorAccountId: string | undefined
): IamContentAccessSummary => {
  const organizationId = item.organizationId ?? activeOrganizationId;
  const canCreate = evaluateAuthorizeDecision(
    buildListAccessAuthorizeRequest({
      instanceId,
      action: buildCreateAction(item.contentType),
      item,
      organizationId,
      actorAccountId,
    }),
    permissions
  ).allowed;
  const updateRequest = buildListAccessAuthorizeRequest({
    instanceId,
    action: buildUpdateAction(item.contentType),
    item,
    organizationId,
    actorAccountId,
  });
  const compatibilityPermissions = permissions.map((permission) => ({
    ...permission,
    ...(permission.accessScope === 'own' || permission.accessScope === 'organization'
      ? { accessScope: undefined }
      : {}),
  }));
  const canUpdate =
    evaluateAuthorizeDecision(updateRequest, permissions).allowed ||
    ((item.authorizationMode === 'credential_visible_compatibility' ||
      readMainserverScopeResolverMode() !== 'automatic') &&
      evaluateAuthorizeDecision(updateRequest, compatibilityPermissions).allowed);

  return canUpdate
    ? {
        state: 'editable',
        canRead: true,
        canCreate,
        canUpdate: true,
        organizationIds: item.organizationId ? [item.organizationId] : [],
        sourceKinds: [],
      }
    : {
        state: 'read_only',
        canRead: true,
        canCreate,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: item.organizationId ? [item.organizationId] : [],
        sourceKinds: [],
      };
};

export const enrichProjectionItemsWithAccess = (
  instanceId: string,
  activeOrganizationId: string | undefined,
  items: readonly IamContentListItem[],
  permissions: readonly EffectivePermission[],
  actorAccountId: string | undefined
): readonly IamContentListItem[] =>
  items.map((item) => ({
    ...item,
    access: resolveItemAccess(instanceId, activeOrganizationId, item, permissions, actorAccountId),
  }));

export const resolveProjectionActorAccountId = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly mainserverTypes: readonly MainserverContentType[];
  readonly visibilityRules: readonly ProjectionReadVisibilityRule[];
  readonly permissions: readonly EffectivePermission[];
}): Promise<string | undefined | Response> => {
  const requiresActorAccountId =
    input.mainserverTypes.length > 0 ||
    input.visibilityRules.some((rule) => rule.allowOwn) ||
    input.permissions.some(
      (permission) => permission.accessScope === 'own' || permission.accessScope === 'organization'
    );
  if (!requiresActorAccountId) return undefined;

  let actorAccountId: string | undefined;
  try {
    actorAccountId = await withInstanceScopedDb(input.instanceId, async (client) =>
      resolveActorAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.ctx.user.id,
      })
    );
  } catch (error) {
    return createListErrorResponse(
      503,
      'database_unavailable',
      error instanceof Error ? error.message : 'Der Akteurkontext konnte nicht geladen werden.',
      getWorkspaceContext().requestId
    );
  }
  return !actorAccountId && input.mainserverTypes.length > 0
    ? createListErrorResponse(
        503,
        'database_unavailable',
        'Der Akteurkontext fuer Mainserver-Inhalte konnte nicht geladen werden.',
        getWorkspaceContext().requestId
      )
    : actorAccountId;
};
