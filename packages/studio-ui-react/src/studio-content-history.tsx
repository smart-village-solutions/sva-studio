import { usePluginTranslation } from '@sva/plugin-sdk/plugin-translations';

import { Button } from './button.js';
import { useStudioTableQuery } from './studio-table-query.js';

import { StudioEmptyState, StudioLoadingState } from './studio-state-blocks.js';

export type StudioContentHistoryEntry = Readonly<{
  id: string;
  action: string;
  actor: string;
  changedFields: readonly string[];
  createdAt: string;
  summary?: string;
}>;

export type StudioContentHistoryLabels = Readonly<{
  loading: string;
  error: string;
  empty: string;
  createHint: string;
  tableLabel: string;
  time: string;
  action: string;
  actor: string;
  summary: string;
  sourceNotice?: string;
  emptySummary: string;
}>;

export type StudioContentHistoryProps = Readonly<{
  contentId?: string;
  contentType: string;
  loadHistory: (contentId: string, signal: AbortSignal) => Promise<readonly StudioContentHistoryEntry[]>;
  labels: StudioContentHistoryLabels;
  formatAction: (action: string) => string;
  formatDate: (value: string) => string;
  formatField?: (field: string) => string;
  formatError?: (error: unknown) => string;
}>;

type HistoryTableProps = Pick<
  StudioContentHistoryProps,
  'formatAction' | 'formatDate' | 'labels'
> & Readonly<{
  entries: readonly StudioContentHistoryEntry[];
  formatField: (field: string) => string;
}>;

const HistoryTable = ({ entries, labels, formatAction, formatDate, formatField }: HistoryTableProps) => (
  <div className="overflow-x-auto rounded-xl border border-border bg-card">
    <table className="min-w-full border-collapse text-sm" aria-label={labels.tableLabel}>
      <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th scope="col" className="px-3 py-2">{labels.time}</th>
          <th scope="col" className="px-3 py-2">{labels.action}</th>
          <th scope="col" className="px-3 py-2">{labels.actor}</th>
          <th scope="col" className="px-3 py-2">{labels.summary}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const fields = entry.changedFields.map(formatField).join(', ');
          return (
            <tr key={entry.id} className="border-t border-border align-top">
              <td className="px-3 py-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
              <td className="px-3 py-3">{formatAction(entry.action)}</td>
              <td className="px-3 py-3 text-muted-foreground">{entry.actor}</td>
              <td className="px-3 py-3 text-muted-foreground">
                {entry.summary || fields || labels.emptySummary}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export function StudioContentHistory({
  contentId,
  contentType,
  loadHistory,
  labels,
  formatAction,
  formatDate,
  formatField = (field) => field,
  formatError = () => labels.error,
}: StudioContentHistoryProps) {
  const t = usePluginTranslation('shared');
  const history = useStudioTableQuery(
    ['content-history', contentType, contentId],
    async (signal) => {
      if (!contentId) return [];
      const entries = await loadHistory(contentId, signal);
      return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    Boolean(contentId)
  );
  const { data: entries, state, error } = history;

  if (!contentId) return <StudioEmptyState>{labels.createHint}</StudioEmptyState>;

  return (
    <div className="space-y-3">
      {labels.sourceNotice ? (
        <p role="note" className="text-sm text-muted-foreground">
          {labels.sourceNotice}
        </p>
      ) : null}
      {state === 'loading' ? <StudioLoadingState>{labels.loading}</StudioLoadingState> : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {formatError(error)}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void history.refetch()}>
            {t('errorFallback.retry')}
          </Button>
        </div>
      ) : null}
      {entries?.length === 0 ? <StudioEmptyState>{labels.empty}</StudioEmptyState> : null}
      {entries && entries.length > 0 ? (
        <HistoryTable
          entries={entries}
          labels={labels}
          formatAction={formatAction}
          formatDate={formatDate}
          formatField={formatField}
        />
      ) : null}
    </div>
  );
}
