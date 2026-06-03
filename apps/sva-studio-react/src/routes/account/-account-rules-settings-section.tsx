import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
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
  statusMessage,
}: Readonly<{
  deletionRules: IamMyDeletionRulesOverview | null;
  contentPreferenceDraft: IamDeletionContentStrategy;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onContentPreferenceChange: (value: IamDeletionContentStrategy) => void;
  onSave: () => void;
  statusMessage: string | null;
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
        {statusMessage ? (
          <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="account-rules-content-preference">
            {t('account.rules.fields.contentPreference')}
          </Label>
          <Select
            id="account-rules-content-preference"
            value={contentPreferenceDraft}
            onChange={(event) => onContentPreferenceChange(event.target.value as IamDeletionContentStrategy)}
            disabled={isLoading || isSaving}
          >
            {deletionContentStrategyOptions.map((option) => (
              <option key={option} value={option}>
                {t(mapContentStrategyKey(option))}
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">{t('account.rules.fields.contentPreferenceHint')}</p>
        </div>
        <Button type="button" onClick={onSave} disabled={isLoading || isSaving}>
          {isSaving ? t('account.rules.actions.saving') : t('account.rules.actions.save')}
        </Button>
      </CardContent>
    </Card>
  );
};
