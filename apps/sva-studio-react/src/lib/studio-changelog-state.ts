import {
  isStudioChangelogEntry,
  type StudioChangelogEntry,
} from './studio-changelog.shared';

export type StudioChangelogState =
  | { readonly status: 'loading'; readonly entries: readonly StudioChangelogEntry[] }
  | { readonly status: 'ready'; readonly entries: readonly StudioChangelogEntry[] }
  | { readonly status: 'error'; readonly entries: readonly StudioChangelogEntry[] };

export const parseStudioChangelogApiEntries = (payload: unknown): readonly StudioChangelogEntry[] => {
  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  const candidate = payload as { entries?: unknown };
  if (!Array.isArray(candidate.entries)) {
    return [];
  }

  return candidate.entries.filter(isStudioChangelogEntry);
};
