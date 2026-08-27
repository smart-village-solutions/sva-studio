import type { MainserverMutationActor } from './mutation-principal.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverOwnershipTransferContent,
  SvaMainserverProjectionContentType,
} from '../types.js';
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

export type OwnershipTransferAudit = Readonly<{
  coverage: 'studio_mutations';
  sourcePrincipalType: 'account' | 'organization';
  sourcePrincipalId: string;
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
