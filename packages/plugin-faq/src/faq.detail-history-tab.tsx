import { fetchIamContentHistory, formatDateTimeInEditorTimeZone, type IamContentHistoryEntry } from '@sva/plugin-sdk';
import { StudioLoadingState } from '@sva/studio-ui-react';
import * as React from 'react';

type Props = Readonly<{ contentId: string; pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string }>;

const actionKeys: Record<IamContentHistoryEntry['action'], string> = {
  created: 'history.actions.created', updated: 'history.actions.updated', status_changed: 'history.actions.statusChanged',
};

export function FaqDetailHistoryTab({ contentId, pt }: Props) {
  const [entries, setEntries] = React.useState<readonly IamContentHistoryEntry[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');

  React.useEffect(() => {
    let active = true;
    setEntries([]);
    setState('loading');
    void fetchIamContentHistory(contentId).then((nextEntries) => {
      if (active) { setEntries([...nextEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt))); setState('ready'); }
    }, () => active && setState('error'));
    return () => { active = false; };
  }, [contentId]);

  if (state === 'loading') return <StudioLoadingState>{pt('history.loading')}</StudioLoadingState>;
  if (state === 'error') return <p role="alert" className="text-sm text-destructive">{pt('history.errors.load')}</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{pt('history.empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse" aria-label={pt('history.tableLabel')}>
        <thead><tr className="border-b border-border/70 text-left text-sm"><th className="px-3 py-2">{pt('history.columns.time')}</th><th className="px-3 py-2">{pt('history.columns.action')}</th><th className="px-3 py-2">{pt('history.columns.actor')}</th><th className="px-3 py-2">{pt('history.columns.summary')}</th></tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-border/50 text-sm"><td className="px-3 py-3">{formatDateTimeInEditorTimeZone(entry.createdAt) ?? entry.createdAt}</td><td className="px-3 py-3">{pt(actionKeys[entry.action])}</td><td className="px-3 py-3">{entry.actor}</td><td className="px-3 py-3">{entry.summary || (entry.changedFields.length ? pt('history.changedFields', { fields: entry.changedFields.join(', ') }) : pt('history.emptySummary'))}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
