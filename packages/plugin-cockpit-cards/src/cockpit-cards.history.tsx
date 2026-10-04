import {
  fetchIamContentHistory,
  formatDateTimeInEditorTimeZone,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { StudioContentHistory } from '@sva/studio-ui-react';

export function CockpitCardsHistory({ contentId }: Readonly<{ contentId: string }>) {
  const pt = usePluginTranslation('cockpit-cards');
  const formatAction = (action: string) => {
    if (action === 'created' || action === 'create') return pt('history.actions.created');
    if (action === 'updated' || action === 'update') return pt('history.actions.updated');
    if (action === 'status_changed' || action === 'statusChanged')
      return pt('history.actions.statusChanged');
    return action;
  };
  return (
    <StudioContentHistory
      contentId={contentId}
      loadHistory={(id) =>
        fetchIamContentHistory(id, { contentType: 'cockpit-cards.cockpit-card' })
      }
      labels={{
        loading: pt('history.loading'),
        error: pt('history.error'),
        empty: pt('history.empty'),
        createHint: pt('history.createHint'),
        tableLabel: pt('history.label'),
        time: pt('history.time'),
        action: pt('history.action'),
        actor: pt('history.actor'),
        summary: pt('history.summary'),
        sourceNotice: pt('history.sourceNotice'),
        emptySummary: pt('history.emptySummary'),
      }}
      formatAction={formatAction}
      formatDate={(value) => formatDateTimeInEditorTimeZone(value) ?? value}
    />
  );
}
