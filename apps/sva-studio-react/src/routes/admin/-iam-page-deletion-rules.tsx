import type { IamDeletionContentStrategy, IamTenantDeletionRulesOverview } from '@sva/core';

import {
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';

import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

import { Checkbox } from '../../components/ui/checkbox';

import { Input } from '../../components/ui/input';

import { Label } from '../../components/ui/label';

import { Select } from '../../components/ui/select';

import { getAdminDeletionRules, saveAdminDeletionRules } from '../../lib/iam-api';

import { type IamCockpitTabKey } from '../../lib/iam-viewer-access';

import { t } from '../../i18n';

import type { DeletionRulesDraft } from './-iam-page-shared';
import {
  createDeletionRulesDraft,
  deletionContentStrategyOptions,
  isAbortError,
  mapDeletionContentStrategyKey,
} from './-iam-page-shared';

export const useDeletionRulesTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
  instanceId,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
  instanceId: string;
}>) => {
  const [deletionRules, setDeletionRules] = React.useState<IamTenantDeletionRulesOverview | null>(
    null
  );
  const [draft, setDraft] = React.useState<DeletionRulesDraft | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const saveFeedback = useStudioSaveFeedback();

  React.useEffect(() => {
    if (
      !cockpitEnabled ||
      !canAccessCockpit ||
      activeTab !== 'deletion-rules' ||
      !allowedTabs.includes('deletion-rules')
    ) {
      return;
    }
    if (!instanceId) {
      setDeletionRules(null);
      setDraft(null);
      setError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getAdminDeletionRules(instanceId)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setDeletionRules(response);
        setDraft(createDeletionRulesDraft(response));
      })
      .catch((nextError) => {
        if (isAbortError(nextError) || controller.signal.aborted) {
          return;
        }
        setDeletionRules(null);
        setDraft(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, instanceId]);

  const saveDeletionRules = async () => {
    if (!instanceId || !draft) {
      setError(t('admin.iam.deletionRules.messages.instanceMissing'));
      return;
    }

    const operationId = saveFeedback.beginSaving();
    setError(null);

    try {
      const response = await saveAdminDeletionRules({
        instanceId,
        deactivateAfterDays: Number(draft.deactivateAfterDays),
        pseudonymizeAfterDays: Number(draft.pseudonymizeAfterDays),
        deleteAfterDays: Number(draft.deleteAfterDays),
        defaultContentStrategy: draft.defaultContentStrategy,
        allowContentPreferenceOverride: draft.allowContentPreferenceOverride,
      });
      setDeletionRules(response);
      setDraft(createDeletionRulesDraft(response));
      saveFeedback.markSaved(operationId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      saveFeedback.markFailed(operationId);
    }
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveDeletionRules();
  };

  const setDraftAndMarkDirty: React.Dispatch<React.SetStateAction<DeletionRulesDraft | null>> = (
    value
  ) => {
    saveFeedback.markDirty();
    setError(null);
    setDraft(value);
  };

  return {
    deletionRules,
    draft,
    error,
    handleSave,
    retrySave: saveDeletionRules,
    isLoading,
    isSaving: saveFeedback.status === 'saving',
    saveStatus: saveFeedback.status,
    setDraft: setDraftAndMarkDirty,
  };
};

export const DeletionRulesTabPanel = ({
  panelId,
  labelledBy,
  state,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useDeletionRulesTabState>;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle>{t('admin.iam.deletionRules.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <p className="text-sm text-muted-foreground">{t('admin.iam.deletionRules.subtitle')}</p>

        {state.error ? (
          <StudioPersistentFormError
            message={state.error}
            retryLabel={state.draft ? t('account.actions.retry') : undefined}
            retryDisabled={state.isSaving}
            onRetry={state.draft ? () => void state.retrySave() : undefined}
          />
        ) : null}

        {state.isLoading || !state.draft ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.iam.deletionRules.messages.loading')}
          </p>
        ) : (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={state.handleSave}>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-deactivate">
                {t('admin.iam.deletionRules.fields.deactivateAfterDays')}
              </Label>
              <Input
                id="deletion-rules-deactivate"
                inputMode="numeric"
                value={state.draft.deactivateAfterDays}
                onChange={(event) =>
                  state.setDraft((current) =>
                    current ? { ...current, deactivateAfterDays: event.target.value } : current
                  )
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-pseudonymize">
                {t('admin.iam.deletionRules.fields.pseudonymizeAfterDays')}
              </Label>
              <Input
                id="deletion-rules-pseudonymize"
                inputMode="numeric"
                value={state.draft.pseudonymizeAfterDays}
                onChange={(event) =>
                  state.setDraft((current) =>
                    current ? { ...current, pseudonymizeAfterDays: event.target.value } : current
                  )
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-delete">
                {t('admin.iam.deletionRules.fields.deleteAfterDays')}
              </Label>
              <Input
                id="deletion-rules-delete"
                inputMode="numeric"
                value={state.draft.deleteAfterDays}
                onChange={(event) =>
                  state.setDraft((current) =>
                    current ? { ...current, deleteAfterDays: event.target.value } : current
                  )
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="deletion-rules-strategy">
                {t('admin.iam.deletionRules.fields.defaultContentStrategy')}
              </Label>
              <Select
                id="deletion-rules-strategy"
                value={state.draft.defaultContentStrategy}
                onChange={(event) =>
                  state.setDraft((current) =>
                    current
                      ? {
                          ...current,
                          defaultContentStrategy: event.target.value as IamDeletionContentStrategy,
                        }
                      : current
                  )
                }
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              >
                {deletionContentStrategyOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(mapDeletionContentStrategyKey(option))}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                id="deletion-rules-allow-override"
                checked={state.draft.allowContentPreferenceOverride}
                onChange={(event) => {
                  const nextChecked = event.currentTarget.checked;
                  state.setDraft((current) =>
                    current
                      ? {
                          ...current,
                          allowContentPreferenceOverride: nextChecked,
                        }
                      : current
                  );
                }}
                disabled={!state.deletionRules?.canEdit || state.isSaving}
              />
              <div className="grid gap-1">
                <Label htmlFor="deletion-rules-allow-override">
                  {t('admin.iam.deletionRules.fields.allowContentPreferenceOverride')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('admin.iam.deletionRules.fields.allowContentPreferenceOverrideHint')}
                </p>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <StudioSaveButton
                type="submit"
                status={state.saveStatus}
                disabled={!state.deletionRules?.canEdit}
                labels={{
                  idle: t('admin.iam.deletionRules.actions.save'),
                  saving: t('admin.iam.deletionRules.actions.saving'),
                  saved: t('admin.iam.deletionRules.actions.saved'),
                }}
              />
              {!state.deletionRules?.canEdit ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.iam.deletionRules.messages.readOnly')}
                </p>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  </div>
);
