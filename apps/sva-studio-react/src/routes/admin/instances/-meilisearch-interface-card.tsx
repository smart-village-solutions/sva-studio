import React from 'react';
import { useStudioSaveFeedback } from '@sva/studio-ui-react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { asIamError, putJson, requestJson } from '../../../lib/iam-http-client';
import {
  emptyMeilisearchDraft,
  meilisearchInterfaceDraftSchema,
} from '../../../lib/instance-interface-meilisearch';
import type { InstanceInterface } from '../../../lib/instance-interfaces';
import { InterfaceForm } from '../../interfaces/-interfaces-page.dialogs';

type StoredMeilisearch = Extract<InstanceInterface, { type: 'meilisearch' }>;
type MeilisearchDraft = ReturnType<typeof emptyMeilisearchDraft>;

const draftFromEntry = (entry: StoredMeilisearch | null): MeilisearchDraft =>
  entry
    ? {
        type: entry.type,
        name: entry.name,
        enabled: entry.enabled,
        config: { ...entry.config, apiKey: '' },
      }
    : emptyMeilisearchDraft();

export const MeilisearchInterfaceCard = ({ instanceId }: { instanceId: string }) => {
  const path = `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/meilisearch-interface`;
  const [entry, setEntry] = React.useState<StoredMeilisearch | null>();
  const [draft, setDraft] = React.useState(emptyMeilisearchDraft);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const feedback = useStudioSaveFeedback();

  React.useEffect(() => {
    let current = true;
    void requestJson<{ data: StoredMeilisearch | null }>(path)
      .then(({ data }) => {
        if (!current) return;
        setEntry(data);
        setDraft(draftFromEntry(data));
      })
      .catch(() => {
        if (current) setLoadFailed(true);
      });
    return () => {
      current = false;
    };
  }, [path]);

  const save = async () => {
    setError(null);
    const id = feedback.beginSaving();
    try {
      const parsed = meilisearchInterfaceDraftSchema.safeParse(draft);
      if (!parsed.success) throw new Error('meilisearch_invalid_config');
      const { data } = await putJson<{ data: StoredMeilisearch }, MeilisearchDraft>(
        path,
        parsed.data
      );
      setEntry(data);
      setDraft(draftFromEntry(data));
      feedback.markSaved(id);
    } catch (cause) {
      const code = asIamError(cause).code;
      const message = cause instanceof Error ? cause.message : '';
      const translationCode = code.startsWith('meilisearch_') ? code : message;
      setError(
        translationCode.startsWith('meilisearch_')
          ? t(`interfaces.meilisearch.errors.${translationCode}`)
          : t('interfaces.messages.saveError')
      );
      feedback.markFailed(id);
    }
  };

  return (
    <Card className="space-y-4 p-4">
      <h3 className="font-semibold">{t('interfaces.types.meilisearch.label')}</h3>
      {loadFailed && (
        <Alert>
          <AlertDescription>{t('interfaces.messages.loadError')}</AlertDescription>
        </Alert>
      )}
      {entry === undefined && !loadFailed && (
        <p role="status">{t('interfaces.messages.loading')}</p>
      )}
      {entry !== undefined && (
        <InterfaceForm
          draft={draft}
          hasStoredMeilisearchKey={entry?.apiKeyConfigured}
          saveStatus={feedback.status}
          saveErrorMessage={error}
          onChange={(next) => {
            if (next.type !== 'meilisearch') return;
            feedback.markDirty();
            setDraft(next);
          }}
          onCancel={() => {
            feedback.markDirty();
            setError(null);
            setDraft(draftFromEntry(entry));
          }}
          onSubmit={() => void save()}
        />
      )}
    </Card>
  );
};
