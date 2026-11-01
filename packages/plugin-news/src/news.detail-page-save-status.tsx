import { Link } from '@tanstack/react-router';
import * as React from 'react';
import {
  Button,
  StudioPersistentActionResult,
  StudioPersistentFormError,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { addNewsCreatedSaveFeedback } from './news.save-feedback.js';
import type { PluginTranslator, StatusMessage } from './news.detail-page.helpers.js';

type NewsDetailSaveStatusProps = Readonly<{
  deleteNavigationFailed: boolean;
  statusMessage: StatusMessage | null;
  pt: PluginTranslator;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  saveCurrentItem: () => Promise<void>;
  checkSaveOutcome: () => Promise<void>;
  checkingSave: boolean;
  retryCreatedContentId: string | null;
  navigateToCreatedDetail: (id: string) => Promise<void>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  completeCreateSave: () => boolean;
  reloadCurrentContext: () => Promise<void>;
}>;

const newsSaveRetryLabel = (status: StatusMessage, pt: PluginTranslator) => {
  if (status.source === 'unknown') return pt('actions.checkSaveOutcome');
  if (status.source === 'save')
    return pt(
      status.errorCode === 'stale_mainserver_context'
        ? 'actions.reloadCurrentContext'
        : 'actions.retry'
    );
  return status.source === 'reference' ? pt('actions.retryMediaReferences') : undefined;
};

const newsSaveRetryAction = (options: NewsDetailSaveStatusProps) => {
  const status = options.statusMessage;
  if (status?.source === 'unknown') return () => void options.checkSaveOutcome();
  if (status?.source === 'save')
    return status.errorCode === 'stale_mainserver_context'
      ? () => void options.reloadCurrentContext()
      : () => void options.saveCurrentItem();
  if (status?.source !== 'reference' || !options.mediaReferenceSync.hasPendingRetry)
    return undefined;
  return () => {
    const operationId = options.saveFeedback.beginSaving();
    void options.mediaReferenceSync.retryReferenceSync().then(
      () => {
        const clean = options.completeCreateSave();
        options.setStatusMessage(
          clean ? null : { source: 'navigation', text: options.pt('create.savedWithNewChanges') }
        );
        if (clean) options.saveFeedback.markSaved(operationId);
        else options.saveFeedback.reset();
        if (clean && options.retryCreatedContentId) {
          void options.navigateToCreatedDetail(options.retryCreatedContentId).catch(() => {
            options.setStatusMessage({
              source: 'navigation',
              text: options.pt('messages.detailNavigationError'),
            });
            options.saveFeedback.markFailed(operationId);
          });
        }
      },
      () => {
        options.setStatusMessage({
          source: 'reference',
          text: options.pt('messages.mediaReferencePartialFailure'),
        });
        options.saveFeedback.markFailed(operationId);
      }
    );
  };
};

export const NewsDetailSaveStatus = (props: NewsDetailSaveStatusProps) => {
  const {
    deleteNavigationFailed,
    statusMessage,
    pt,
    saveFeedback,
    checkingSave,
    retryCreatedContentId,
  } = props;
  return (
    <>
      {deleteNavigationFailed ? (
        <StudioPersistentActionResult
          kind="success"
          title={pt('messages.deleteSuccess')}
          description={pt('messages.deleteNavigationError')}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
          }
        />
      ) : null}
      {statusMessage?.source === 'recovered' ? (
        <StudioPersistentActionResult kind="success" title={statusMessage.text} />
      ) : statusMessage ? (
        <StudioPersistentFormError
          message={statusMessage.text}
          requestId={statusMessage.requestId}
          requestIdLabel={statusMessage.requestId ? pt('messages.requestReference') : undefined}
          copyRequestIdLabel={
            statusMessage.requestId ? pt('messages.copyRequestReference') : undefined
          }
          requestIdCopiedLabel={
            statusMessage.requestId ? pt('messages.requestReferenceCopied') : undefined
          }
          requestIdCopyFailedLabel={
            statusMessage.requestId ? pt('messages.requestReferenceCopyFailed') : undefined
          }
          retryLabel={newsSaveRetryLabel(statusMessage, pt)}
          retryDisabled={checkingSave || saveFeedback.status === 'saving'}
          onRetry={newsSaveRetryAction(props)}
        />
      ) : null}
      {retryCreatedContentId ? (
        <p>
          <Link
            to="/admin/news/$id"
            params={{ id: retryCreatedContentId }}
            state={(previous) => addNewsCreatedSaveFeedback(previous, retryCreatedContentId)}
          >
            {pt('actions.openCreatedDetail')}
          </Link>
        </p>
      ) : null}
    </>
  );
};
