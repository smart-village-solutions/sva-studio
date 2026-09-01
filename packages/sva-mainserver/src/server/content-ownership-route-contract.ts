import type { MainserverMutationActor } from './mutation-principal.js';
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
  'surveys.survey'
>;

export type ContentOwnershipRouteMatch = Readonly<{
  contentType: SvaMainserverProjectionContentType;
  contentId: string;
  operation: 'authorization' | 'targets' | 'transfer';
}>;

export type SupportedContentOwnershipRouteMatch = Omit<ContentOwnershipRouteMatch, 'contentType'> &
  Readonly<{ contentType: SupportedOwnershipContentType }>;

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
      return !['FAQ', 'COCKPIT_CARD', PROJECTS_GENERIC_TYPE].includes(item.genericType);
    default:
      return true;
  }
};
