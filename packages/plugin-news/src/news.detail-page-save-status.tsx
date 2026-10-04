import { Link } from '@tanstack/react-router';
import * as React from 'react';
import {
  Button,
  StudioPersistentActionResult,
  StudioPersistentFormError,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
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
  setRetryCreatedContentId,
  mediaReferenceSync,
}: Readonly<{
  deleteNavigationFailed: boolean;
  statusMessage: StatusMessage | null;
  pt: PluginTranslator;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  saveCurrentItem: () => Promise<void>;
  retryCreatedContentId: string | null;
  navigateToCreatedDetail: (id: string) => Promise<void>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  setRetryCreatedContentId: React.Dispatch<React.SetStateAction<string | null>>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
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
        retryLabel={
          statusMessage.source === 'save'
            ? pt('actions.retry')
            : statusMessage.source === 'navigation'
              ? pt('actions.openCreatedDetail')
              : statusMessage.source === 'reference'
                ? pt('actions.retryMediaReferences')
                : undefined
        }
        retryDisabled={saveFeedback.status === 'saving'}
        onRetry={
          statusMessage.source === 'save'
            ? () => void saveCurrentItem()
            : statusMessage.source === 'navigation' && retryCreatedContentId
              ? () => {
                  const operationId = saveFeedback.beginSaving();
                  void navigateToCreatedDetail(retryCreatedContentId).then(
                    () => {
                      setStatusMessage(null);
                      setRetryCreatedContentId(null);
                      saveFeedback.markSaved(operationId);
                    },
                    () => saveFeedback.markFailed(operationId)
                  );
                }
              : mediaReferenceSync.hasPendingRetry
                ? () => {
                    const operationId = saveFeedback.beginSaving();
                    void mediaReferenceSync.retryReferenceSync().then(
                      () => {
                        setStatusMessage(null);
                        saveFeedback.markSaved(operationId);
                        if (retryCreatedContentId) {
                          const createdContentId = retryCreatedContentId;
                          void navigateToCreatedDetail(createdContentId).then(
                            () => setRetryCreatedContentId(null),
                            () => {
                              setRetryCreatedContentId(createdContentId);
                              setStatusMessage({
                                source: 'navigation',
                                text: pt('messages.detailNavigationError'),
                              });
                              saveFeedback.markFailed(operationId);
                            }
                          );
                        } else {
                          setRetryCreatedContentId(null);
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
  </>
);
