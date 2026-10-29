import {
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  type usePluginTranslation,
} from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';

export function ProjectHistoryTab({
  pt,
  contentId,
}: Readonly<{ pt: ReturnType<typeof usePluginTranslation>; contentId?: string }>) {
  return (
    <StudioContentHistory
      contentId={contentId}
      loadHistory={(id) => fetchIamContentHistory(id, { contentType: 'projects.project' })}
      labels={{
        loading: pt('history.loading'),
        error: pt('history.error'),
        empty: pt('history.empty'),
        createHint: pt('history.createHint'),
        tableLabel: pt('history.tableLabel'),
        time: pt('history.columns.time'),
        action: pt('history.columns.action'),
        actor: pt('history.columns.actor'),
        summary: pt('history.columns.summary'),
        sourceNotice: pt('history.sourceNotice'),
        emptySummary: pt('history.emptySummary'),
      }}
      formatAction={(action) =>
        pt(
          action === 'created'
            ? 'history.actions.created'
            : action === 'status_changed'
              ? 'history.actions.statusChanged'
              : 'history.actions.updated'
        )
      }
      formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
    />
  );
}
