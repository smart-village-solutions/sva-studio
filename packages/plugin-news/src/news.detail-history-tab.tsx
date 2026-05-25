import * as React from 'react';
import { fetchIamContentHistory, formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { StudioLoadingState } from '@sva/studio-ui-react';

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
    return <p className="text-sm text-muted-foreground">{pt('history.createHint')}</p>;
  }

  if (isLoading) {
    return <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>;
  }

  if (errorMessage) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{pt('history.empty')}</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{pt(entry.actionLabelKey)}</span>
            <span className="text-xs text-muted-foreground">{formatHistoryDate(entry.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pt('history.byline', { actor: entry.actor })}</p>
          {entry.summary ? <p className="mt-2 text-sm text-foreground">{entry.summary}</p> : null}
          {entry.changedFields.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {pt('history.changedFields', { fields: entry.changedFields.join(', ') })}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
