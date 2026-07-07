export const STUDIO_CHANGELOG_ENTRY_DIRECTORY = 'docs/changelog/entries';
export const STUDIO_CHANGELOG_ENTRY_PATTERN = /^docs\/changelog\/entries\/pr-(\d+)\.json$/u;
export const STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH = 'generated/studio-changelog.json';
export const STUDIO_CHANGELOG_ENTRY_LIMIT = 20;
export const STUDIO_CHANGELOG_RAW_HTML_PATTERN = /<\/?[a-z][\w-]*(?:\s[^<>]*)?\s*\/?>/iu;

export type StudioChangelogEntry = {
  readonly prNumber: number;
  readonly body: string;
};

export type StudioChangelogEntryDocument = {
  readonly prNumber: number;
  readonly body: string;
};

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;

export const parseStudioChangelogEntryPathPrNumber = (filePath: string): number => {
  const match = filePath.match(STUDIO_CHANGELOG_ENTRY_PATTERN);
  if (!match) {
    throw new Error(`Dateiname ${filePath} liegt nicht im erwarteten Format docs/changelog/entries/pr-<nummer>.json.`);
  }

  return Number(match[1]);
};

export const assertStudioChangelogBody = (filePath: string, body: unknown): string => {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new Error(`Datei ${filePath} muss ein body-Feld enthalten, das nicht leer ist.`);
  }

  const trimmedBody = body.trim();
  if (STUDIO_CHANGELOG_RAW_HTML_PATTERN.test(trimmedBody)) {
    throw new Error(`Datei ${filePath} darf kein rohes HTML enthalten.`);
  }

  return trimmedBody;
};

export const parseStudioChangelogEntryDocument = (
  filePath: string,
  source: string
): StudioChangelogEntryDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Datei ${filePath} enthält kein gültiges JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Datei ${filePath} muss ein JSON-Objekt enthalten.`);
  }

  const candidate = parsed as { prNumber?: unknown; body?: unknown };
  if (!isPositiveInteger(candidate.prNumber)) {
    throw new Error(`Datei ${filePath} muss ein positives Integer-Feld prNumber enthalten.`);
  }

  return {
    prNumber: Number(candidate.prNumber),
    body: assertStudioChangelogBody(filePath, candidate.body),
  };
};

export const compareStudioChangelogEntriesDescending = (
  left: Pick<StudioChangelogEntry, 'prNumber'>,
  right: Pick<StudioChangelogEntry, 'prNumber'>
): number => right.prNumber - left.prNumber;

export const isStudioChangelogEntry = (value: unknown): value is StudioChangelogEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isPositiveInteger(candidate.prNumber) &&
    typeof candidate.body === 'string' &&
    candidate.body.trim().length > 0
  );
};
