import {
  checkOptionalProcessing,
  createDataSubjectRequest,
  requestDataExport,
} from '../../lib/iam-api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { t } from '../../i18n';
import { AccountDeletionRulesCard } from './-account-deletion-rules-card';
import {
  PrivacyActionPanel,
  PrivacyCasesSection,
  PrivacyEmptyStateCard,
  PrivacyProcessingCard,
} from './-account-privacy-sections';
import { useAccountPrivacyState } from './-account-privacy-state';

export const AccountPrivacyPage = () => {
  const {
    contentPreferenceDraft,
    deletionRules,
    deletionRulesError,
    deletionRulesStatusMessage,
    errorMessage,
    hasDeletionRulesAccess,
    isLoading,
    isLoadingDeletionRules,
    isSavingDeletionRules,
    isSubmitting,
    overview,
    runAction,
    saveDeletionRulesPreference,
    setContentPreferenceDraft,
    setStatusMessage,
    statusMessage,
  } = useAccountPrivacyState();

  const hasNoEntries =
    overview &&
    overview.requests.length === 0 &&
    overview.exportJobs.length === 0 &&
    overview.legalHolds.length === 0;
  return (
    <section className="space-y-5" aria-busy={isLoading || isSubmitting || isLoadingDeletionRules || isSavingDeletionRules}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.privacy.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('account.privacy.subtitle')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,1fr)]">
        <section className="space-y-4">
          <PrivacyActionPanel
            disabled={isSubmitting}
            onExport={() =>
              void runAction(async () => {
                await requestDataExport({ format: 'json', async: true });
                setStatusMessage(t('account.privacy.actions.exportQueued'));
              })
            }
            onRequestAccess={() =>
              void runAction(async () => {
                await createDataSubjectRequest({ type: 'access' });
                setStatusMessage(t('account.privacy.actions.accessRequested'));
              })
            }
            onSubmitObjection={() =>
              void runAction(async () => {
                await createDataSubjectRequest({ type: 'objection' });
                setStatusMessage(t('account.privacy.actions.optOutRequested'));
              })
            }
          />

          <AccountDeletionRulesCard
            deletionRules={deletionRules}
            hasDeletionRulesAccess={hasDeletionRulesAccess}
            isLoadingDeletionRules={isLoadingDeletionRules}
            deletionRulesError={deletionRulesError}
            deletionRulesStatusMessage={deletionRulesStatusMessage}
            contentPreferenceDraft={contentPreferenceDraft}
            isSavingDeletionRules={isSavingDeletionRules}
            onContentPreferenceChange={setContentPreferenceDraft}
            onSave={() => void saveDeletionRulesPreference()}
          />

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

          {isLoading ? <p className="text-sm text-muted-foreground">{t('account.privacy.messages.loading')}</p> : null}

          {hasNoEntries ? (
            <PrivacyEmptyStateCard
              disabled={isSubmitting}
              onRequestAccess={() =>
                void runAction(async () => {
                  await createDataSubjectRequest({ type: 'access' });
                  setStatusMessage(t('account.privacy.actions.accessRequested'));
                })
              }
            />
          ) : null}

          <PrivacyCasesSection
            title={t('account.privacy.sections.exportJobs')}
            items={overview?.exportJobs ?? []}
            prefix="export"
          />

          <PrivacyCasesSection
            title={t('account.privacy.sections.requests')}
            items={overview?.requests ?? []}
            prefix="request"
          />
        </section>

        <PrivacyProcessingCard
          disabled={isSubmitting}
          legalHolds={overview?.legalHolds ?? []}
          nonEssentialProcessingAllowed={overview?.nonEssentialProcessingAllowed}
          processingRestrictedAt={overview?.processingRestrictedAt}
          processingRestrictionReason={overview?.processingRestrictionReason}
          nonEssentialProcessingOptOutAt={overview?.nonEssentialProcessingOptOutAt}
          onCheckProcessing={() =>
            void runAction(async () => {
              const response = await checkOptionalProcessing();
              if ('error' in response) {
                setStatusMessage(
                  response.blockedByRestriction || response.blockedByObjection
                    ? t('account.privacy.processing.blocked')
                    : response.error
                );
                return;
              }
              setStatusMessage(t('account.privacy.processing.allowedCheck'));
            })
          }
        />
      </div>
    </section>
  );
};
