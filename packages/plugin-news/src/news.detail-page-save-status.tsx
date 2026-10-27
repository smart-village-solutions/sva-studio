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

export const NewsDetailSaveStatus = ({
  deleteNavigationFailed,
  statusMessage,
  pt,
  saveFeedback,
  saveCurrentItem,
  retryCreatedContentId,
  navigateToCreatedDetail,
  setStatusMessage,
  mediaReferenceSync,
  completeCreateSave,
}: Readonly<{
  deleteNavigationFailed: boolean;
  statusMessage: StatusMessage | null;
  pt: PluginTranslator;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  saveCurrentItem: () => Promise<void>;
  retryCreatedContentId: string | null;
  navigateToCreatedDetail: (id: string) => Promise<void>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  completeCreateSave: () => boolean;
}>) => (
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
    {statusMessage ? (
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
        retryLabel={
          statusMessage.source === 'save'
            ? pt('actions.retry')
            : statusMessage.source === 'reference'
              ? pt('actions.retryMediaReferences')
              : undefined
        }
        retryDisabled={saveFeedback.status === 'saving'}
        onRetry={
          statusMessage.source === 'save'
            ? () => void saveCurrentItem()
            : statusMessage.source === 'reference' && mediaReferenceSync.hasPendingRetry
              ? () => {
                  const operationId = saveFeedback.beginSaving();
                  void mediaReferenceSync.retryReferenceSync().then(
                    () => {
                      const clean = completeCreateSave();
                      setStatusMessage(
                        clean
                          ? null
                          : { source: 'navigation', text: pt('create.savedWithNewChanges') }
                      );
                      saveFeedback.markSaved(operationId);
                      if (clean && retryCreatedContentId) {
                        void navigateToCreatedDetail(retryCreatedContentId).catch(() => {
                          setStatusMessage({
                            source: 'navigation',
                            text: pt('messages.detailNavigationError'),
                          });
                          saveFeedback.markFailed(operationId);
                        });
                      }
                    },
                    () => {
                      setStatusMessage({
                        source: 'reference',
                        text: pt('messages.mediaReferencePartialFailure'),
                      });
                      saveFeedback.markFailed(operationId);
                    }
                  );
                }
              : undefined
        }
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
