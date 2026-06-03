import { Alert, AlertDescription } from '../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { t } from '../../i18n';
import { AccountRulesSettingsSection } from './-account-rules-settings-section';
import { AccountRulesSummaryCards } from './-account-rules-summary-cards';
import { useAccountRulesState } from './-account-rules-state';

export const AccountRulesPage = () => {
  const state = useAccountRulesState();

  return (
    <section className="space-y-6" aria-busy={state.isLoading || state.isSaving}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.rules.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('account.rules.subtitle')}</p>
      </header>

      <AccountRulesSummaryCards deletionRules={state.deletionRules} isLoading={state.isLoading} />

      <Card>
        <CardHeader>
          <CardTitle>{t('account.rules.sections.global.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('account.rules.sections.global.deactivateAfterDays')}</p>
          <p>{t('account.rules.sections.global.pseudonymizeAfterDays')}</p>
          <p>{t('account.rules.sections.global.deleteAfterDays')}</p>
          <p>{t('account.rules.sections.global.defaultContentStrategy')}</p>
        </CardContent>
      </Card>

      {state.errorMessage && !state.deletionRules ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{state.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <AccountRulesSettingsSection
        deletionRules={state.deletionRules}
        contentPreferenceDraft={state.contentPreferenceDraft}
        errorMessage={state.deletionRules ? state.errorMessage : null}
        isLoading={state.isLoading}
        isSaving={state.isSaving}
        onContentPreferenceChange={state.setContentPreferenceDraft}
        onSave={() => void state.saveContentPreference()}
        statusMessage={state.statusMessage}
      />
    </section>
  );
};
