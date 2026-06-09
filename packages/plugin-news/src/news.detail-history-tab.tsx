import * as React from 'react';
import { fetchIamContentHistory, formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { StudioLoadingState } from '@sva/studio-ui-react';

import { NewsDetailCard } from './news.detail-card.js';
import { createNewsHistoryEntries } from './news.history.js';

export type NewsDetailHistoryTabProps = Readonly<{
  contentId?: string;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const resolveHistoryErrorMessage = (
  pt: NewsDetailHistoryTabProps['pt'],
  error: unknown
) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;

  if (code === 'forbidden') {
    return pt('history.errors.forbidden');
  }

  if (code === 'not_found') {
    return pt('history.errors.notFound');
  }

  return pt('history.errors.load');
};

const formatHistoryDate = (value: string) => formatDateTimeInEditorTimeZone(value) ?? value;

const buildHistorySummary = (
  pt: NewsDetailHistoryTabProps['pt'],
  entry: ReturnType<typeof createNewsHistoryEntries>[number]
) => {
  if (entry.summary) {
    return entry.summary;
  }

  if (entry.changedFields.length > 0) {
    return pt('history.changedFields', { fields: entry.changedFields.join(', ') });
  }

  return pt('history.emptySummary');
};

export function NewsDetailHistoryTab({ contentId, pt }: NewsDetailHistoryTabProps) {
  const [entries, setEntries] = React.useState<ReturnType<typeof createNewsHistoryEntries>>([]);
  const [isLoading, setIsLoading] = React.useState(Boolean(contentId));
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!contentId) {
      setEntries([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void fetchIamContentHistory(contentId)
      .then((historyEntries) => {
        if (cancelled) {
          return;
        }
        setEntries(createNewsHistoryEntries(historyEntries));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(resolveHistoryErrorMessage(pt, error));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId, pt]);

  if (!contentId) {
    return (
      <NewsDetailCard
        title={pt('cards.history.title')}
        description={pt('cards.history.description')}
      >
        <p className="text-sm text-muted-foreground">{pt('history.createHint')}</p>
      </NewsDetailCard>
    );
  }

  if (isLoading) {
    return (
      <NewsDetailCard
        title={pt('cards.history.title')}
        description={pt('cards.history.description')}
      >
        <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>
      </NewsDetailCard>
    );
  }

  if (errorMessage) {
    return (
      <NewsDetailCard
        title={pt('cards.history.title')}
        description={pt('cards.history.description')}
      >
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      </NewsDetailCard>
    );
  }

  return (
    <NewsDetailCard
      title={pt('cards.history.title')}
      description={pt('cards.history.description')}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pt('history.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('history.tableLabel')}>
            <thead>
              <tr className="border-b border-border/70 text-left text-sm">
                <th className="px-3 py-2 font-semibold text-foreground">{pt('history.columns.time')}</th>
                <th className="px-3 py-2 font-semibold text-foreground">{pt('history.columns.action')}</th>
                <th className="px-3 py-2 font-semibold text-foreground">{pt('history.columns.actor')}</th>
                <th className="px-3 py-2 font-semibold text-foreground">{pt('history.columns.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 align-top text-sm last:border-b-0">
                  <td className="px-3 py-3 text-muted-foreground">{formatHistoryDate(entry.createdAt)}</td>
                  <td className="px-3 py-3 text-foreground">{pt(entry.actionLabelKey)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{entry.actor}</td>
                  <td className="px-3 py-3 text-muted-foreground">{buildHistorySummary(pt, entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </NewsDetailCard>
  );
}
