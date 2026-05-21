import React from 'react';

import {
  checkOptionalProcessing,
  createDataSubjectRequest,
  requestDataExport,
  requestPermissionChange,
} from '../../lib/iam-api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { ModalDialog } from '../../components/ModalDialog';
import { Textarea } from '../../components/ui/textarea';
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
    setErrorMessage,
    setStatusMessage,
    statusMessage,
  } = useAccountPrivacyState();
  const [permissionChangeDialogOpen, setPermissionChangeDialogOpen] = React.useState(false);
  const [permissionChangeNote, setPermissionChangeNote] = React.useState('');

  const hasNoEntries =
    overview &&
    overview.requests.length === 0 &&
    overview.exportJobs.length === 0 &&
    overview.legalHolds.length === 0;

  const handlePermissionChangeSubmit = async () => {
    const trimmedNote = permissionChangeNote.trim();
    if (!trimmedNote) {
      setErrorMessage(t('account.privacy.permissionChange.validation.required'));
      return;
    }

    await runAction(async () => {
      await requestPermissionChange({ requestNote: trimmedNote });
      setPermissionChangeDialogOpen(false);
      setPermissionChangeNote('');
      setStatusMessage(t('account.privacy.permissionChange.messages.requested'));
    });
  };

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
            onRequestPermissionChange={() => {
              setErrorMessage(null);
              setStatusMessage(null);
              setPermissionChangeNote('');
              setPermissionChangeDialogOpen(true);
            }}
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

      <ModalDialog
        open={permissionChangeDialogOpen}
        title={t('account.privacy.permissionChange.dialog.title')}
        description={t('account.privacy.permissionChange.dialog.description')}
        onClose={() => {
          setPermissionChangeDialogOpen(false);
          setPermissionChangeNote('');
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePermissionChangeSubmit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="permission-change-note">
              {t('account.privacy.permissionChange.fields.requestNote')}
            </Label>
            <Textarea
              id="permission-change-note"
              value={permissionChangeNote}
              onChange={(event) => setPermissionChangeNote(event.target.value)}
              rows={5}
              disabled={isSubmitting}
              placeholder={t('account.privacy.permissionChange.fields.requestNotePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('account.privacy.permissionChange.fields.requestNoteHint')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setPermissionChangeDialogOpen(false);
                setPermissionChangeNote('');
              }}
            >
              {t('account.privacy.permissionChange.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('account.privacy.permissionChange.actions.submit')}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </section>
  );
};
