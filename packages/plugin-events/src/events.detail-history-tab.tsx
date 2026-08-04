import { fetchIamContentHistory, formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';

type Translate = (key: string) => string;

const actionKey = (action: string) =>
  action === 'created'
    ? 'history.actions.created'
    : action === 'status_changed'
      ? 'history.actions.statusChanged'
      : 'history.actions.updated';

export function EventsDetailHistoryTab({ contentId, pt }: Readonly<{ contentId?: string; pt: Translate }>) {
  return (
    <StudioContentHistory
      contentId={contentId}
      loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'events.event-record' })}
      labels={{
        loading: pt('history.loading'), error: pt('history.error'), empty: pt('history.empty.title'),
        createHint: pt('history.createHint'), tableLabel: pt('history.tableLabel'),
        time: pt('history.columns.time'), action: pt('history.columns.action'),
        actor: pt('history.columns.actor'), summary: pt('history.columns.summary'),
        sourceNotice: pt('history.sourceNotice'), emptySummary: pt('history.emptySummary'),
      }}
      formatAction={(action) => pt(actionKey(action))}
      formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
    />
  );
}
