import {
  canUseEditorialAudioSources,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';

import { SvaMainserverError } from './errors.js';

type Media = Readonly<{
  contentType?: string | null;
  sourceUrl?: Readonly<{ url?: string | null }> | null;
}>;

export const collectBlockMedia = (
  blocks: readonly Readonly<{ mediaContents?: readonly Media[] | null }>[] = []
): readonly Media[] => blocks.flatMap((block) => block.mediaContents ?? []);

export const changedEditorialAudioUrls = (
  next: readonly Media[] = [],
  existing: readonly Media[] = []
): string[] => {
  const audioUrl = (media: Media) =>
    media.contentType?.trim().toLowerCase() === 'audio' ? (media.sourceUrl?.url ?? '') : null;
  const previouslySaved = new Set(existing.map(audioUrl));
  return next
    .map(audioUrl)
    .filter((url): url is string => url !== null && !previouslySaved.has(url));
};

export const validateEditorialAudioUrls = async (
  context: Readonly<{
    request: Request;
    ctx: AuthenticatedRequestContext;
    instanceId: string;
    targetType: string;
    targetId?: string;
  }>,
  urls: readonly string[]
): Promise<void> => {
  if (urls.length === 0 || (await canUseEditorialAudioSources({ ...context, urls }))) return;
  throw new SvaMainserverError({
    code: 'invalid_request',
    statusCode: 400,
    message: 'Die Audioquelle ist ungültig oder nicht freigegeben. Wählen Sie Studio-Assets über die Medienbibliothek aus.',
  });
};

export const validateEditorialAudio = (
  context: Parameters<typeof validateEditorialAudioUrls>[0],
  next?: readonly Media[],
  existing?: readonly Media[]
) => validateEditorialAudioUrls(context, changedEditorialAudioUrls(next, existing));
