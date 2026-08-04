import { fetchIamContentHistory, formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';

type Props = Readonly<{
  contentId: string;
  pt: (key: string) => string;
}>;

const actionKey = (action: string) =>
  action === 'created'
    ? 'history.actions.created'
    : action === 'status_changed'
      ? 'history.actions.statusChanged'
      : 'history.actions.updated';

export function FaqDetailHistoryTab({ contentId, pt }: Props) {
  return (
    <StudioContentHistory
      contentId={contentId}
      loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'faq.faq' })}
      labels={{
        loading: pt('history.loading'), error: pt('history.errors.load'), empty: pt('history.empty'),
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
