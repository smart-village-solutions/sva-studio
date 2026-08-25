import { createHash } from 'node:crypto';

import { withAuthenticatedUser } from '@sva/auth-runtime/server';

import {
  loadUserDocumentation,
  logUserDocumentationError,
  UserDocumentationError,
} from './user-documentation.server';

const pathPrefix = '/api/studio/documentation/';

const createPayloadEtag = (payload: unknown): string =>
  `"${createHash('sha256').update(JSON.stringify(payload)).digest('base64url')}"`;

export const dispatchUserDocumentationRequest = async (request: Request): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(pathPrefix)) {
    return null;
  }
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }
  const encodedId = pathname.slice(pathPrefix.length);
  if (!encodedId || encodedId.includes('/')) {
    return Response.json({ error: 'documentation_page_unknown' }, { status: 404 });
  }
  let pageId: string;
  try {
    pageId = decodeURIComponent(encodedId);
  } catch {
    return Response.json({ error: 'documentation_page_unknown' }, { status: 404 });
  }

  return withAuthenticatedUser(request, async () => {
    try {
      const payload = await loadUserDocumentation(pageId);
      const payloadEtag = createPayloadEtag(payload);
      if (request.headers.get('if-none-match') === payloadEtag) {
        return new Response(null, { status: 304, headers: { etag: payloadEtag } });
      }
      return Response.json(payload, {
        headers: {
          'cache-control': 'private, max-age=60',
          etag: payloadEtag,
        },
      });
    } catch (error) {
      const controlled =
        error instanceof UserDocumentationError
          ? error
          : new UserDocumentationError('documentation_upstream_unavailable', 502);
      logUserDocumentationError(pageId, controlled);
      return Response.json({ error: controlled.code }, { status: controlled.status });
    }
  });
};
