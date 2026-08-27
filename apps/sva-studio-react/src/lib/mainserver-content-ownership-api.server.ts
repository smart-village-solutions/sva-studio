import { dispatchSvaMainserverContentOwnershipRequest } from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

type ProjectionContentType = Parameters<typeof refreshProjectionAfterMainserverMutation>[2];

const supportedContentTypes = new Set<ProjectionContentType>([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
  'surveys.survey',
]);

const readContentType = (request: Request): ProjectionContentType | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const ownershipIndex = segments.findIndex((segment) => segment === 'content-ownership');
  const encoded = ownershipIndex >= 0 ? segments[ownershipIndex + 1] : undefined;
  if (!encoded) return undefined;
  let contentType: string;
  try {
    contentType = decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
  return supportedContentTypes.has(contentType as ProjectionContentType)
    ? (contentType as ProjectionContentType)
    : undefined;
};

export const dispatchMainserverContentOwnershipRequest = async (
  request: Request
): Promise<Response | null> => {
  const response = await dispatchSvaMainserverContentOwnershipRequest(request);
  const contentType = response ? readContentType(request) : undefined;
  if (response && contentType) {
    await refreshProjectionAfterMainserverMutation(request, response, contentType);
  }
  return response;
};
