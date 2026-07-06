import { t } from '../i18n';
import { parseStudioChangelogApiEntries, type StudioChangelogState } from '../lib/studio-changelog-state';
import { StudioChangelogMarkdown } from '../lib/studio-changelog-markdown';
import type { StudioChangelogEntry } from '../lib/studio-changelog.shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const mergedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatMergedAt = (value: string): string => {
  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? value : mergedAtFormatter.format(new Date(parsedValue));
};

export const loadStudioChangelogState = async (): Promise<StudioChangelogState> => {
  try {
    const response = await fetch('/api/studio/changelog');
    if (!response.ok) {
      throw new Error(`changelog fetch failed with ${response.status}`);
    }

    return {
      status: 'ready',
      entries: parseStudioChangelogApiEntries(await response.json()),
    };
  } catch {
    return {
      status: 'error',
      entries: [],
    };
  }
};

const StudioChangelogCards = ({
  entries,
}: {
  readonly entries: readonly StudioChangelogEntry[];
}) => (
  <div className="grid gap-4">
    {entries.map((entry) => (
      <Card key={`${entry.prNumber}-${entry.mergedAt}`}>
        <CardHeader>
          <CardTitle>{t('home.changelog.entryTitle', { prNumber: entry.prNumber })}</CardTitle>
          <CardDescription>{formatMergedAt(entry.mergedAt)}</CardDescription>
        </CardHeader>
        <CardContent>
          <StudioChangelogMarkdown>{entry.body}</StudioChangelogMarkdown>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const StudioChangelogSection = ({
  changelogState,
}: {
  readonly changelogState: StudioChangelogState;
}) => (
  <section className="mt-10">
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">{t('home.changelog.title')}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{t('home.changelog.description')}</p>
    </div>

    {changelogState.status === 'error' ? (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{t('home.changelog.error')}</p>
        </CardContent>
      </Card>
    ) : changelogState.status === 'loading' ? (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{t('home.changelog.loading')}</p>
        </CardContent>
      </Card>
    ) : changelogState.entries.length === 0 ? (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{t('home.changelog.empty')}</p>
        </CardContent>
      </Card>
    ) : (
      <StudioChangelogCards entries={changelogState.entries} />
    )}
  </section>
);
