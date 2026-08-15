import type { EventWebUrl } from './events.types.js';

export const compactEventString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const serializeEventWebUrls = (urls: readonly EventWebUrl[] | undefined | null) =>
  (urls ?? [])
    .map((entry) => ({
      ...(compactEventString(entry?.url) ? { url: compactEventString(entry?.url) as string } : {}),
      ...(compactEventString(entry?.description)
        ? { description: compactEventString(entry?.description) }
        : {}),
    }))
    .filter((entry): entry is { url: string; description?: string } => Boolean(entry.url));
