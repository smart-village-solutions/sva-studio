import { Alert, AlertDescription } from '../../../components/ui/alert';
import { useMediaDetail } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

import { MediaDetailImageControlsSection } from './-media-detail-image-controls-section.js';
import { MediaDetailMetadataSection } from './-media-detail-metadata-section.js';
import { MediaDetailTechnicalSection } from './-media-detail-technical-section.js';
import { MediaDetailUsageSection } from './-media-detail-usage-section.js';
import { MediaDetailWorkspaceHeader } from './-media-detail-workspace-header.js';
import type { MediaDetailPageProps } from './-media-ui.shared.js';

const mediaErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('media.messages.loadError');
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
      return t('media.messages.loadError');
  }
};

export const MediaDetailPage = ({ assetId }: MediaDetailPageProps) => {
  const mediaApi = useMediaDetail(assetId);

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
        onResolveDelivery={() => void mediaApi.resolveDelivery()}
        onDelete={() => void mediaApi.deleteMedia()}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,1fr)]">
        <div className="space-y-6">
          <MediaDetailMetadataSection asset={mediaApi.asset} />
          <MediaDetailImageControlsSection asset={mediaApi.asset} />
        </div>
        <div className="space-y-6">
          <MediaDetailUsageSection usage={mediaApi.usage} />
          <MediaDetailTechnicalSection asset={mediaApi.asset} delivery={mediaApi.delivery} />
        </div>
      </div>
    </section>
  );
};
