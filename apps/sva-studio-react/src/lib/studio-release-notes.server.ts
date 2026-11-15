/** Authenticated read-only release feed for the fixed Studio repository. */
import { withAuthenticatedUser } from '@sva/auth-runtime/server';
import type { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';

import {
  studioReleaseNotesSchema,
  studioReleaseTagPattern,
  type StudioReleaseNotes,
} from './studio-release-notes.shared';

const API_URL =
  'https://api.github.com/repos/smart-village-solutions/sva-studio/releases?per_page=100';
const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_MS = 5 * 60_000;
const TIMEOUT_MS = 5_000;
const upstreamSchema = z
  .array(
    z.object({
      tag_name: z.string(),
      draft: z.boolean(),
      prerelease: z.boolean(),
      name: z.string().nullable(),
      published_at: z.string().nullable(),
      body: z.string().nullable(),
    })
  )
  .max(100);
let cached: { data: StudioReleaseNotes; expiresAt: number } | undefined;
let pending: Promise<StudioReleaseNotes> | undefined;
let logger: ReturnType<typeof createSdkLogger> | undefined;

const parseReleaseNotes = (source: string): StudioReleaseNotes => {
  const releases = upstreamSchema.parse(JSON.parse(source));
  return studioReleaseNotesSchema.parse(
    releases
      .filter(
        (release) =>
          !release.draft && !release.prerelease && studioReleaseTagPattern.test(release.tag_name)
      )
      .sort((left, right) => (right.published_at ?? '').localeCompare(left.published_at ?? ''))
      .slice(0, 20)
      .map((release) => ({
        tag: release.tag_name,
        name: release.name?.trim() || release.tag_name,
        publishedAt: release.published_at,
        body: release.body ?? '',
      }))
  );
};

const fetchReleaseNotes = async (): Promise<StudioReleaseNotes> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      headers: { accept: 'application/vnd.github+json' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('application/json') ||
      Number(response.headers.get('content-length') ?? 0) > MAX_BYTES ||
      !response.body
    ) {
      throw new Error('release_feed_unavailable');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        throw new Error('release_feed_too_large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = parseReleaseNotes(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    cached = { data, expiresAt: Date.now() + CACHE_MS };
    return data;
  } finally {
    clearTimeout(timeout);
  }
};

/** Shares only public repository data; authentication remains per request. */
export const loadStudioReleaseNotes = (): Promise<StudioReleaseNotes> => {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
  pending ??= fetchReleaseNotes().finally(() => {
    pending = undefined;
  });
  return pending;
};

export const dispatchStudioReleaseNotesRequest = async (
  request: Request
): Promise<Response | null> => {
  if (new URL(request.url).pathname !== '/api/studio/releases') return null;
  if (request.method !== 'GET')
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  return withAuthenticatedUser(request, async () => {
    try {
      return Response.json(await loadStudioReleaseNotes(), {
        headers: { 'cache-control': 'private, max-age=60' },
      });
    } catch {
      if (!logger) {
        const { createSdkLogger } = await import('@sva/server-runtime');
        logger = createSdkLogger({ component: 'studio-release-notes' });
      }
      logger.warn('Studio release feed unavailable', {
        operation: 'load_release_notes',
        error_type: 'upstream_unavailable',
      });
      return Response.json({ error: 'release_notes_unavailable' }, { status: 502 });
    }
  });
};
