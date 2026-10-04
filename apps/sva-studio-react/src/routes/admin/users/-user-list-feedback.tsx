import type { IamUserImportSyncReport } from '@sva/core';
import { Button } from '@sva/studio-ui-react';

import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { t } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';
import { userErrorMessage } from './-user-error-message';
import {
  type BulkReprovisionFeedbackState,
  type SyncStatusState,
  type UsersApiState,
} from './user-list-model';

const syncOutcomeTranslationKey = {
  success: 'admin.users.messages.syncOutcome.success',
  partial_failure: 'admin.users.messages.syncOutcome.partialFailure',
  blocked: 'admin.users.messages.syncOutcome.blocked',
  failed: 'admin.users.messages.syncOutcome.failed',
} as const;

export const UserListSyncFeedback = ({
  syncError,
  syncResult,
  syncStatus,
  onRetry,
}: {
  syncError: Parameters<typeof userErrorMessage>[0];
  syncResult: IamUserImportSyncReport | null;
  syncStatus: SyncStatusState;
  onRetry: () => Promise<void>;
}) => {
  if (syncStatus === 'pending') {
    return (
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {t('admin.users.messages.syncRunning')}
      </p>
    );
  }

  if (syncStatus === 'success' && syncResult) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
        <AlertDescription>
          {t('admin.users.messages.syncResult', {
            checkedCount: syncResult.checkedCount,
            correctedCount: syncResult.correctedCount,
            manualReviewCount: syncResult.manualReviewCount,
            importedCount: syncResult.importedCount,
            updatedCount: syncResult.updatedCount,
            skippedCount: syncResult.skippedCount,
          })}
          <span className="block text-xs text-muted-foreground">
            {t(syncOutcomeTranslationKey[syncResult.outcome])}
          </span>
          {syncResult.diagnostics ? (
            <span className="block text-xs text-muted-foreground">
              {t('admin.users.messages.syncDiagnostics', {
                authRealm: syncResult.diagnostics.authRealm,
                providerSource:
                  syncResult.diagnostics.providerSource === 'instance'
                    ? t('admin.users.messages.syncProviderSource.instance')
                    : syncResult.diagnostics.providerSource === 'fallback_global'
                      ? t('admin.users.messages.syncProviderSource.fallback_global')
                      : syncResult.diagnostics.providerSource === 'platform'
                        ? t('admin.users.messages.syncProviderSource.platform')
                        : t('admin.users.messages.syncProviderSource.global'),
                matchedWithoutInstanceAttributeCount: String(
                  syncResult.diagnostics.matchedWithoutInstanceAttributeCount ?? 0
                ),
              })}
            </span>
          ) : null}
          {syncResult.objects && syncResult.objects.length > 0 ? (
            <span className="block text-xs text-muted-foreground">
              {t('admin.users.messages.syncObjectDiagnostics', {
                count: syncResult.objects.length,
                codes: Array.from(
                  new Set(
                    syncResult.objects.flatMap((entry) =>
                      entry.diagnostics.map((diagnostic) => diagnostic.code)
                    )
                  )
                ).join(', '),
              })}
            </span>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  if (syncStatus === 'empty' && syncResult) {
    return (
      <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
        <AlertDescription>
          {t('admin.users.messages.syncEmpty', {
            skippedCount: syncResult.skippedCount,
          })}
          <span className="block text-xs text-muted-foreground">
            {t(syncOutcomeTranslationKey[syncResult.outcome])}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  if (syncStatus === 'error' && syncError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive" role="alert">
        <AlertDescription className="flex flex-col gap-3">
          <span>{userErrorMessage(syncError)}</span>
          <IamRuntimeDiagnosticDetails error={syncError} />
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => void onRetry()}>
              {t('admin.users.actions.retry')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export const UserListErrorAlert = ({
  error,
  onRetry,
}: {
  error: UsersApiState['error'];
  onRetry: () => void;
}) =>
  error ? (
    <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
      <AlertDescription className="flex flex-col gap-3">
        <span>{userErrorMessage(error)}</span>
        <IamRuntimeDiagnosticDetails error={error} />
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            {t('admin.users.actions.retry')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  ) : null;

export const UserListBulkReprovisionFeedback = ({
  feedback,
}: {
  feedback: BulkReprovisionFeedbackState;
}) => {
  if (!feedback) {
    return null;
  }

  const renderFailureMessage = (
    failure: NonNullable<BulkReprovisionFeedbackState>['failures'][number]
  ) => {
    const localizedMessage = userErrorMessage(
      new IamHttpError({
        status: failure.code === 'not_found' ? 404 : failure.code === 'forbidden' ? 403 : 409,
        code: failure.code,
        message: failure.message,
      }),
      'mutation'
    );
    return localizedMessage === t('admin.users.messages.mutationError') &&
      failure.message.trim().length > 0
      ? failure.message
      : localizedMessage;
  };

  return (
    <Alert className="border-secondary/40 bg-secondary/10 text-secondary" role="status">
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {t('admin.users.messages.bulkReprovisionSuccessCount', { count: feedback.successCount })}
        </span>
        <span>
          {t('admin.users.messages.bulkReprovisionFailureCount', { count: feedback.failureCount })}
        </span>
        {feedback.failures.length > 0 ? (
          <ul
            className="list-disc pl-5 text-xs text-muted-foreground"
            aria-label={t('admin.users.messages.bulkReprovisionFailuresLabel')}
          >
            {feedback.failures.map((failure) => (
              <li key={failure.id}>
                {t('admin.users.messages.bulkReprovisionFailureItem', {
                  id: failure.id,
                  code: failure.code,
                  message: renderFailureMessage(failure),
                })}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

export const UserListPaginationFooter = ({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}) => (
  <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
    <p key={page} className="animate-pagination-active" aria-live="polite">
      {t('admin.users.pagination.pageLabel', { page, totalPages: pageCount })}
    </p>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        {t('admin.users.pagination.previous')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={page >= pageCount}
        onClick={() => setPage(page + 1)}
      >
        {t('admin.users.pagination.next')}
      </Button>
    </div>
  </footer>
);
