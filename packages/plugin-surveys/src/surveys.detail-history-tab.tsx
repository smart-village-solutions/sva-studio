import { fetchIamContentHistory, formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';

import { SurveyDetailCard } from './surveys.detail-card.js';

export type SurveyDetailHistoryTabProps = Readonly<{
  contentId?: string;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const actionKey = (action: string) =>
  action === 'created'
    ? 'history.actions.created'
    : action === 'status_changed'
      ? 'history.actions.statusChanged'
      : 'history.actions.updated';

const formatError = (pt: SurveyDetailHistoryTabProps['pt'], error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return code === 'forbidden'
    ? pt('history.errors.forbidden')
    : code === 'not_found'
      ? pt('history.errors.notFound')
      : pt('history.errors.load');
};

export function SurveyDetailHistoryTab({ contentId, pt }: SurveyDetailHistoryTabProps) {
  return (
    <SurveyDetailCard title={pt('cards.history.title')} description={pt('cards.history.description')}>
      <StudioContentHistory
        contentId={contentId}
        loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'surveys.survey' })}
        labels={{
          loading: pt('history.loading'), error: pt('history.errors.load'), empty: pt('history.empty'),
          createHint: pt('history.createHint'), tableLabel: pt('history.tableLabel'),
          time: pt('history.columns.time'), action: pt('history.columns.action'),
          actor: pt('history.columns.actor'), summary: pt('history.columns.summary'),
          sourceNotice: pt('history.sourceNotice'), emptySummary: pt('history.emptySummary'),
        }}
        formatAction={(action) => pt(actionKey(action))}
        formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
        formatError={(error) => formatError(pt, error)}
      />
    </SurveyDetailCard>
  );
}
