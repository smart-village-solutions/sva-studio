import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';
import {
  StudioPersistentFormError,
  StudioSaveButton,
  type StudioSaveStatus,
} from '@sva/studio-ui-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';

const deletionContentStrategyOptions: readonly IamDeletionContentStrategy[] = [
  'retain',
  'with_owner_lifecycle',
] as const;

const mapContentStrategyKey = (strategy: IamDeletionContentStrategy) => {
  switch (strategy) {
    case 'with_owner_lifecycle':
      return 'account.rules.strategies.with_owner_lifecycle';
    case 'retain':
    default:
      return 'account.rules.strategies.retain';
  }
};

export const AccountRulesSettingsSection = ({
  deletionRules,
  contentPreferenceDraft,
  errorMessage,
  isLoading,
  isSaving,
  onContentPreferenceChange,
  onSave,
  saveStatus,
}: Readonly<{
  deletionRules: IamMyDeletionRulesOverview | null;
  contentPreferenceDraft: IamDeletionContentStrategy;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onContentPreferenceChange: (value: IamDeletionContentStrategy) => void;
  onSave: () => void;
  saveStatus: StudioSaveStatus;
}>) => {
  if (!deletionRules?.rules.allowContentPreferenceOverride) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('account.rules.sections.personal.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <StudioPersistentFormError
            message={errorMessage}
            retryLabel={t('account.actions.retry')}
            retryDisabled={isSaving}
            onRetry={onSave}
          />
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="account-rules-content-preference">
            {t('account.rules.fields.contentPreference')}
          </Label>
          <Select
            id="account-rules-content-preference"
            value={contentPreferenceDraft}
            onChange={(event) =>
              onContentPreferenceChange(event.target.value as IamDeletionContentStrategy)
            }
            disabled={isLoading || isSaving}
          >
            {deletionContentStrategyOptions.map((option) => (
              <option key={option} value={option}>
                {t(mapContentStrategyKey(option))}
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            {t('account.rules.fields.contentPreferenceHint')}
          </p>
        </div>
        <StudioSaveButton
          type="button"
          onClick={onSave}
          status={saveStatus}
          disabled={isLoading}
          labels={{
            idle: t('account.rules.actions.save'),
            saving: t('account.rules.actions.saving'),
            saved: t('account.rules.actions.saved'),
          }}
        />
      </CardContent>
    </Card>
  );
};
