import type { IamDeletionContentStrategy, IamMyDeletionRulesOverview } from '@sva/core';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';

const deletionContentStrategyOptions: readonly IamDeletionContentStrategy[] = [
  'retain',
  'with_owner_lifecycle',
] as const;

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

const mapLifecycleStateKey = (state: IamMyDeletionRulesOverview['lifecycleState']) => {
  switch (state) {
    case 'deactivated':
      return 'account.privacy.deletionRules.lifecycle.deactivated';
    case 'pseudonymized':
      return 'account.privacy.deletionRules.lifecycle.pseudonymized';
    case 'deleted':
      return 'account.privacy.deletionRules.lifecycle.deleted';
    default:
      return 'account.privacy.deletionRules.lifecycle.active';
  }
};

type AccountDeletionRulesCardProps = {
  readonly deletionRules: IamMyDeletionRulesOverview | null;
  readonly hasDeletionRulesAccess: boolean;
  readonly isLoadingDeletionRules: boolean;
  readonly deletionRulesError: string | null;
  readonly deletionRulesStatusMessage: string | null;
  readonly contentPreferenceDraft: IamDeletionContentStrategy;
  readonly isSavingDeletionRules: boolean;
  readonly onContentPreferenceChange: (value: IamDeletionContentStrategy) => void;
  readonly onSave: () => void;
};

export const AccountDeletionRulesCard = ({
  deletionRules,
  hasDeletionRulesAccess,
  isLoadingDeletionRules,
  deletionRulesError,
  deletionRulesStatusMessage,
  contentPreferenceDraft,
  isSavingDeletionRules,
  onContentPreferenceChange,
  onSave,
}: AccountDeletionRulesCardProps) => {
  if (!hasDeletionRulesAccess) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('account.privacy.deletionRules.title')}</CardTitle>
        <CardDescription>{t('account.privacy.deletionRules.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deletionRulesStatusMessage ? (
          <Alert className="border-primary/40 bg-primary/10 text-primary" role="status">
            <AlertDescription>{deletionRulesStatusMessage}</AlertDescription>
          </Alert>
        ) : null}
        {deletionRulesError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{deletionRulesError}</AlertDescription>
          </Alert>
        ) : null}
        {isLoadingDeletionRules || !deletionRules ? (
          <p className="text-sm text-muted-foreground">{t('account.privacy.deletionRules.messages.loading')}</p>
        ) : (
          <>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.lastLoginAt')}
                </dt>
                <dd className="text-foreground">{formatDateTime(deletionRules.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.lifecycleState')}
                </dt>
                <dd className="text-foreground">{t(mapLifecycleStateKey(deletionRules.lifecycleState))}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.deactivateAfterDays')}
                </dt>
                <dd className="text-foreground">{deletionRules.rules.deactivateAfterDays}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.pseudonymizeAfterDays')}
                </dt>
                <dd className="text-foreground">{deletionRules.rules.pseudonymizeAfterDays}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.deleteAfterDays')}
                </dt>
                <dd className="text-foreground">{deletionRules.rules.deleteAfterDays}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('account.privacy.deletionRules.summary.tenantDefaultStrategy')}
                </dt>
                <dd className="text-foreground">
                  {t(`account.privacy.deletionRules.strategies.${deletionRules.rules.defaultContentStrategy}` as const)}
                </dd>
              </div>
            </dl>

            {deletionRules.rules.allowContentPreferenceOverride ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="account-deletion-content-preference">
                    {t('account.privacy.deletionRules.fields.contentPreference')}
                  </Label>
                  <Select
                    id="account-deletion-content-preference"
                    value={contentPreferenceDraft}
                    onChange={(event) => onContentPreferenceChange(event.target.value as IamDeletionContentStrategy)}
                    disabled={isSavingDeletionRules}
                  >
                    {deletionContentStrategyOptions.map((option) => (
                      <option key={option} value={option}>
                        {t(`account.privacy.deletionRules.strategies.${option}` as const)}
                      </option>
                    ))}
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {deletionRules.contentPreference.isOverridden
                      ? t('account.privacy.deletionRules.messages.overrideActive')
                      : t('account.privacy.deletionRules.messages.overrideInactive')}
                  </p>
                </div>

                <Button type="button" onClick={onSave} disabled={isSavingDeletionRules}>
                  {isSavingDeletionRules
                    ? t('account.privacy.deletionRules.actions.saving')
                    : t('account.privacy.deletionRules.actions.save')}
                </Button>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};
