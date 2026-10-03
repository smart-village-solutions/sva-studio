import {
  authorizeContentPrimitiveForUser,
  loadExternalContentCore,
  loadExternalContentReferenceByContentId,
  resolveActorInfo,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { SvaMainserverGenericItem } from '../types.js';

import { errorJson } from './content-route-core.js';
import { PROJECTS_CONTENT_TYPE, PROJECTS_GENERIC_TYPE } from './projects-contract.js';
import { SvaMainserverError } from './errors.js';
import { projectSourceReferenceInput } from './projects-route-transport.js';
import { getSvaMainserverGenericItem } from './service.js';

export type ProjectActor = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
}>;

export const authorizeProjectOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: 'projects.read' | 'projects.create' | 'projects.update' | 'projects.delete',
  resource?: {
    readonly contentId?: string;
    readonly organizationId?: string;
    readonly ownerUserId?: string;
    readonly ownerOrganizationId?: string;
  }
): Promise<ProjectActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: { contentType: PROJECTS_CONTENT_TYPE, ...resource },
    credentialVisibleCompatibility: action !== 'projects.read',
  });
  if (!result.ok)
    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    ...(result.actor.organizationId ? { activeOrganizationId: result.actor.organizationId } : {}),
  };
};

export const requireProjectCsrf = (request: Request): Response | null => {
  const response = validateCsrf(request, getWorkspaceContext().requestId);
  return response
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
};

export const projectActorInfoOrResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<
  | Readonly<{
      instanceId: string;
      actorAccountId: string;
      requestId?: string;
      traceId?: string;
    }>
  | Response
> => {
  const resolved = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in resolved) return resolved.error;
  return resolved.actor.actorAccountId
    ? { ...resolved.actor, actorAccountId: resolved.actor.actorAccountId }
    : errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
};

export const loadProjectLocalContext = async (instanceId: string, contentId: string) => {
  const reference = await loadExternalContentReferenceByContentId({
    ...projectSourceReferenceInput(instanceId),
    contentId,
  }).catch(() => undefined);
  const loadedCore = reference
    ? await loadExternalContentCore(instanceId, reference.contentId).catch(() => undefined)
    : undefined;
  const core = loadedCore?.contentType === PROJECTS_CONTENT_TYPE ? loadedCore : undefined;
  return { core, reference };
};

export const projectAuthorizationResource = (
  contentId: string,
  core: Awaited<ReturnType<typeof loadProjectLocalContext>>['core'],
  fallbackOwner: { readonly activeOrganizationId?: string; readonly actorAccountId: string }
) => {
  const owner = core
    ? {
        organizationId: core.organizationId,
        ownerUserId: core.ownerUserId,
        ownerOrganizationId: core.ownerOrganizationId,
      }
    : {
        organizationId: fallbackOwner.activeOrganizationId,
        ownerUserId: !fallbackOwner.activeOrganizationId ? fallbackOwner.actorAccountId : undefined,
        ownerOrganizationId: fallbackOwner.activeOrganizationId,
      };
  return {
    contentId,
    ...(owner.organizationId ? { organizationId: owner.organizationId } : {}),
    ...(owner.ownerUserId ? { ownerUserId: owner.ownerUserId } : {}),
    ...(owner.ownerOrganizationId ? { ownerOrganizationId: owner.ownerOrganizationId } : {}),
  };
};

export const loadProjectContext = async (
  instanceId: string,
  keycloakSubject: string,
  contentId: string,
  activeOrganizationId?: string,
  localContext?: Awaited<ReturnType<typeof loadProjectLocalContext>>
) => {
  const { core, reference } =
    localContext ?? (await loadProjectLocalContext(instanceId, contentId));
  const genericItemId = reference?.sourceEntityId ?? contentId;
  let item: SvaMainserverGenericItem | undefined;
  try {
    item = await getSvaMainserverGenericItem({
      instanceId,
      keycloakSubject,
      ...(activeOrganizationId ? { activeOrganizationId } : {}),
      genericItemId,
    });
  } catch (error) {
    if (!(error instanceof SvaMainserverError) || error.code !== 'not_found') throw error;
  }
  if (!item) return undefined;
  if (item.genericType !== PROJECTS_GENERIC_TYPE) return undefined;
  return { core, reference, item };
};
