import { resolveActorInfo, type AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import {
  resolveMainserverMutationActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverOwnershipTransferContent,
  SvaMainserverProjectionContentType,
} from '../types.js';
import { PROJECTS_GENERIC_TYPE } from './projects-contract.js';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
} from './service.js';

export type SupportedOwnershipContentType = Exclude<
  SvaMainserverProjectionContentType,
  'surveys.survey' | 'vouchers.voucher' | 'construction-sites.construction-site' | 'jobs.job'
>;

export type ContentOwnershipRouteMatch = Readonly<{
  contentType: Exclude<
    SvaMainserverProjectionContentType,
    'vouchers.voucher' | 'construction-sites.construction-site' | 'jobs.job'
  >;
  contentId: string;
  operation: 'authorization' | 'targets' | 'transfer';
}>;

export type SupportedContentOwnershipRouteMatch = Omit<ContentOwnershipRouteMatch, 'contentType'> &
  Readonly<{ contentType: SupportedOwnershipContentType }>;

const routePrefix = '/api/v1/mainserver/content-ownership/';
const supportedContentTypes = new Set<ContentOwnershipRouteMatch['contentType']>([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
  'surveys.survey',
]);
const isProjectionContentType = (
  value: string
): value is ContentOwnershipRouteMatch['contentType'] =>
  supportedContentTypes.has(value as ContentOwnershipRouteMatch['contentType']);

export const matchContentOwnershipRoute = (request: Request): ContentOwnershipRouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(routePrefix)) return null;
  const segments = pathname.slice(routePrefix.length).split('/');
  if (segments.length !== 3) return null;
  const [encodedContentType, encodedContentId, operation] = segments;
  let contentType: string;
  let contentId: string;
  try {
    contentType = decodeURIComponent(encodedContentType ?? '');
    contentId = decodeURIComponent(encodedContentId ?? '');
  } catch {
    return null;
  }
  return isProjectionContentType(contentType) &&
    contentId.length > 0 &&
    (operation === 'authorization' || operation === 'targets' || operation === 'transfer')
    ? { contentType, contentId, operation }
    : null;
};

export const readTransferOperationId = (request: Request): string | undefined => {
  if (request.method !== 'GET') return undefined;
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(routePrefix)) return undefined;
  return /^operations\/([A-Za-z0-9][A-Za-z0-9._:-]{7,127})$/.exec(
    pathname.slice(routePrefix.length)
  )?.[1];
};

export type OwnershipTransferAudit = Readonly<{
  coverage: 'studio_mutations';
  sourcePrincipalResolution: 'resolved' | 'unresolved' | 'failed';
  sourcePrincipalType?: 'account' | 'organization';
  sourcePrincipalId?: string;
  targetPrincipalType: 'account' | 'organization';
  targetPrincipalId: string;
  sourceDataProviderId: string;
  targetDataProviderId: string;
  targetBindingVersion: string;
}>;

export const resolveOwnershipRouteActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<MainserverMutationActor | Response> => {
  const resolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in resolution) return resolution.error;
  return resolveMainserverMutationActor({
    request,
    ctx,
    authorizedActor: {
      instanceId: resolution.actor.instanceId,
      keycloakSubject: ctx.user.id,
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
    },
  });
};

export const toOwnershipTransferContent = (
  contentType: SupportedOwnershipContentType,
  contentId: string
): SvaMainserverOwnershipTransferContent => {
  switch (contentType) {
    case 'news.article':
      return { type: 'news', id: contentId };
    case 'events.event-record':
      return { type: 'event', id: contentId };
    case 'poi.point-of-interest':
      return { type: 'poi', id: contentId };
    case 'generic-items.generic-item':
    case 'faq.faq':
    case 'cockpit-cards.cockpit-card':
    case 'projects.project':
      return { type: 'generic-item', id: contentId };
  }
};

export const loadOwnershipItem = async (
  connection: SvaMainserverConnectionInput | MainserverMutationActor,
  content: SvaMainserverOwnershipTransferContent
) => {
  switch (content.type) {
    case 'news':
      return getSvaMainserverNews({ ...connection, newsId: content.id });
    case 'event':
      return getSvaMainserverEvent({ ...connection, eventId: content.id });
    case 'poi':
      return getSvaMainserverPoi({ ...connection, poiId: content.id });
    case 'generic-item':
      return getSvaMainserverGenericItem({ ...connection, genericItemId: content.id });
  }
};

export const matchesOwnershipContentType = (
  contentType: SupportedOwnershipContentType,
  item: Awaited<ReturnType<typeof loadOwnershipItem>>
): boolean => {
  if (item === undefined || !('genericType' in item)) return item !== undefined;
  switch (contentType) {
    case 'faq.faq':
      return item.genericType === 'FAQ';
    case 'cockpit-cards.cockpit-card':
      return item.genericType === 'COCKPIT_CARD';
    case 'projects.project':
      return item.genericType === PROJECTS_GENERIC_TYPE;
    case 'generic-items.generic-item':
      return !['FAQ', 'COCKPIT_CARD', PROJECTS_GENERIC_TYPE, 'Voucher', 'Job'].includes(
        item.genericType
      );
    default:
      return true;
  }
};
