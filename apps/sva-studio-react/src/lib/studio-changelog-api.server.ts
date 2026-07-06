import { loadStudioChangelogEntries } from './studio-changelog.server';

const CHANGELOG_PATH = '/api/studio/changelog';

export const dispatchStudioChangelogRequest = async (request: Request): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname;
  if (pathname !== CHANGELOG_PATH) {
    return null;
  }

  if (request.method !== 'GET') {
    return new Response(null, { status: 405 });
  }

  try {
    const entries = await loadStudioChangelogEntries();
    return Response.json({ entries });
  } catch {
    return Response.json(
      {
        error: 'studio_changelog_unavailable',
        message: 'Studio-Changelog konnte nicht geladen werden.',
      },
      { status: 500 }
    );
  }
};
