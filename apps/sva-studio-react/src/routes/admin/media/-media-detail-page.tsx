import * as React from 'react';
import type { MediaEditorialMetadataPatch, MediaFocusPoint } from '@sva/media';
import { useNavigate } from '@tanstack/react-router';

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { useMediaDetail } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError, IamRegisteredMediaAsset } from '../../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../../lib/studio-permission-denial-message';
import { useAccessDecision } from '../../../providers/effective-access-provider';

import { MediaDetailImageControlsSection } from './-media-detail-image-controls-section.js';
import { MediaDetailMetadataSection } from './-media-detail-metadata-section.js';
import { MediaDetailTechnicalSection } from './-media-detail-technical-section.js';
import { MediaDetailUsageSection } from './-media-detail-usage-section.js';
import {
  MediaDetailWorkspaceHeader,
  MediaDetailDeliveryTools,
} from './-media-detail-workspace-header.js';
import type { MediaDetailPageProps } from './-media-ui.shared.js';

const mediaErrorMessage = (error: IamHttpError | null): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
  if (!error) {
    return t('media.detail.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'conflict':
      return t('media.errors.conflict');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    case 'notFound':
    case 'not_found':
      return t('media.errors.notFound');
    default:
      return t('media.detail.loadError');
  }
};

const resolveMediaScanResult = (
  asset: IamRegisteredMediaAsset
): 'infected' | 'clean' | 'unavailable' | 'unknown' => {
  const lastError = asset.technical.lastError;
  const errorCode =
    typeof lastError === 'object' && lastError !== null && 'code' in lastError
      ? lastError.code
      : undefined;

  if (asset.uploadStatus === 'blocked' || errorCode === 'media_scan_infected') return 'infected';
  if (asset.technical.scanStatus === 'clean') return 'clean';
  if (
    errorCode === 'media_scan_unavailable' ||
    errorCode === 'media_scan_stale' ||
    errorCode === 'media_scan_incomplete'
  )
    return 'unavailable';
  return 'unknown';
};

export const MediaDetailPage = ({ assetId }: MediaDetailPageProps) => {
  const [metadataDraft, setMetadataDraft] = React.useState<MediaEditorialMetadataPatch>();
  const [focusDraft, setFocusDraft] = React.useState<{
    assetId: string;
    point: MediaFocusPoint | null;
  }>();
  const [saving, setSaving] = React.useState(false);
  const createDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.create'] },
  });
  const updateDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.update'] },
  });
  const deleteDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.delete'] },
  });
  const publicDeliveryDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.read'] },
  });
  const protectedDeliveryDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.deliver.protected'] },
  });
  const mediaApi = useMediaDetail(assetId);
  const navigate = useNavigate();

  const handleDelete = async () => {
    const deleted = await mediaApi.deleteMedia();
    if (!deleted) {
      return;
    }

    await navigate({ to: '/admin/media' });
  };

  if (mediaApi.isLoading) {
    return (
      <section data-testid="media-detail-page">
        <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>
      </section>
    );
  }

  if (!mediaApi.asset || !mediaApi.usage) {
    return (
      <section data-testid="media-detail-page">
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{mediaErrorMessage(mediaApi.error)}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const scanResult = resolveMediaScanResult(mediaApi.asset);

  return (
    <section className="space-y-6" data-testid="media-detail-page" data-asset-id={assetId}>
      {mediaApi.mutationError ? (
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{mediaErrorMessage(mediaApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <MediaDetailWorkspaceHeader
        asset={mediaApi.asset}
        usageCount={mediaApi.usage.totalReferences}
        delivery={mediaApi.delivery}
        focusPoint={
          focusDraft?.assetId === assetId
            ? focusDraft.point
            : (mediaApi.asset.metadata.focusPoint ?? null)
        }
        onFocusChange={(point) => setFocusDraft({ assetId, point })}
        canEditFocus={
          updateDecision.status === 'allowed' &&
          !saving &&
          mediaApi.asset.processingStatus === 'ready' &&
          mediaApi.asset.uploadStatus === 'processed'
        }
        copyAction={
          <MediaDetailImageControlsSection
            asset={mediaApi.asset}
            metadataDraft={metadataDraft}
            canCreateCopy={
              createDecision.status === 'allowed' &&
              !saving &&
              (mediaApi.asset.visibility === 'public'
                ? publicDeliveryDecision.status === 'allowed'
                : protectedDeliveryDecision.status === 'allowed')
            }
          />
        }
      />

      {scanResult !== 'clean' && scanResult !== 'unknown' ? (
        <Alert
          role="status"
          aria-labelledby="media-scan-title"
          className={
            scanResult === 'infected' ? 'border-destructive/40 text-destructive' : undefined
          }
        >
          <AlertTitle id="media-scan-title">{t('media.scan.title')}</AlertTitle>
          <AlertDescription>{t(`media.scan.${scanResult}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,1fr)]">
        <div className="space-y-6">
          <MediaDetailMetadataSection
            key={mediaApi.asset.id}
            asset={mediaApi.asset}
            focusPoint={focusDraft?.assetId === assetId ? focusDraft.point : undefined}
            onResetFocus={() => setFocusDraft(undefined)}
            onSavingChange={setSaving}
            canEdit={
              updateDecision.status === 'allowed' &&
              mediaApi.asset.processingStatus === 'ready' &&
              mediaApi.asset.uploadStatus === 'processed'
            }
            onDraftChange={setMetadataDraft}
            onSave={async (metadata) => {
              const saved = await mediaApi.updateMedia({ metadata });
              if (saved) setFocusDraft(undefined);
              return saved;
            }}
          />
        </div>
        <div className="space-y-6">
          <MediaDetailUsageSection usage={mediaApi.usage} />
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-semibold">
              {t('media.detail.moreInformation')}
            </summary>
            <div className="mt-4 space-y-4">
              <MediaDetailTechnicalSection asset={mediaApi.asset} delivery={mediaApi.delivery} />
              {scanResult === 'clean' || scanResult === 'unknown' ? (
                <div
                  role="status"
                  aria-label={t('media.scan.title')}
                  className="text-sm text-muted-foreground"
                >
                  {t(`media.scan.${scanResult}`)}
                </div>
              ) : null}
              {scanResult === 'clean' ? (
                <p className="text-sm text-muted-foreground">
                  {t('media.detail.visibilityFixedHint')}
                </p>
              ) : null}
              <MediaDetailDeliveryTools
                asset={mediaApi.asset}
                delivery={mediaApi.delivery}
                onResolveDelivery={() => void mediaApi.resolveDelivery()}
                onDelete={() => void handleDelete()}
                canDelete={deleteDecision.status === 'allowed'}
                canResolveDelivery={
                  mediaApi.asset.visibility === 'protected'
                    ? protectedDeliveryDecision.status === 'allowed'
                    : publicDeliveryDecision.status === 'allowed'
                }
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
};
