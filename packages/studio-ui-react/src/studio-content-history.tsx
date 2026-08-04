import * as React from 'react';

import { StudioEmptyState, StudioLoadingState } from './studio-primitives.js';

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
  loadHistory: (contentId: string) => Promise<readonly StudioContentHistoryEntry[]>;
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
          <th className="px-3 py-2">{labels.time}</th>
          <th className="px-3 py-2">{labels.action}</th>
          <th className="px-3 py-2">{labels.actor}</th>
          <th className="px-3 py-2">{labels.summary}</th>
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
  loadHistory,
  labels,
  formatAction,
  formatDate,
  formatField = (field) => field,
  formatError = () => labels.error,
}: StudioContentHistoryProps) {
  const [entries, setEntries] = React.useState<readonly StudioContentHistoryEntry[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>(contentId ? 'loading' : 'ready');
  const [errorMessage, setErrorMessage] = React.useState(labels.error);
  const loadHistoryRef = React.useRef(loadHistory);
  const formatErrorRef = React.useRef(formatError);
  loadHistoryRef.current = loadHistory;
  formatErrorRef.current = formatError;

  React.useEffect(() => {
    if (!contentId) {
      setEntries([]);
      setState('ready');
      return;
    }
    let active = true;
    setEntries([]);
    setState('loading');
    setErrorMessage(labels.error);
    void loadHistoryRef.current(contentId).then(
      (nextEntries) => {
        if (!active) return;
        setEntries([...nextEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
        setState('ready');
      },
      (error) => {
        if (!active) return;
        setErrorMessage(formatErrorRef.current(error));
        setState('error');
      }
    );
    return () => {
      active = false;
    };
  }, [contentId, labels.error]);

  if (!contentId) return <StudioEmptyState>{labels.createHint}</StudioEmptyState>;

  return (
    <div className="space-y-3">
      {labels.sourceNotice ? (
        <p role="note" className="text-sm text-muted-foreground">
          {labels.sourceNotice}
        </p>
      ) : null}
      {state === 'loading' ? <StudioLoadingState>{labels.loading}</StudioLoadingState> : null}
      {state === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {state === 'ready' && entries.length === 0 ? <StudioEmptyState>{labels.empty}</StudioEmptyState> : null}
      {state === 'ready' && entries.length > 0 ? (
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
