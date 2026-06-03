import { Link } from '@tanstack/react-router';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { useMediaLibrary } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

import { MediaAssetGrid } from './-media-asset-grid.js';
import { MediaIntakeShelf } from './-media-intake-shelf.js';
import { MediaLibraryToolbar } from './-media-library-toolbar.js';
import { MediaPriorityShelf } from './-media-priority-shelf.js';
import { countMediaPriorityBuckets } from './-media-library-view-model.js';

const mediaErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('media.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    default:
      return t('media.messages.loadError');
  }
};

export const MediaLibraryPage = () => {
  const mediaApi = useMediaLibrary();
  const priorityBuckets = countMediaPriorityBuckets(
    mediaApi.assets,
    mediaApi.usageByAssetId,
    mediaApi.usageStatusByAssetId
  );

  if (mediaApi.isLoading) {
    return (
      <section data-testid="media-library-page">
        <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>
      </section>
    );
  }

  if (mediaApi.error) {
    return (
      <section data-testid="media-library-page">
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{mediaErrorMessage(mediaApi.error)}</AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="media-library-page">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('media.page.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('media.page.subtitle')}</p>
        </div>
        <Button asChild>
          <Link to="/admin/media/new">{t('media.actions.create')}</Link>
        </Button>
      </header>

      <MediaIntakeShelf />
      <MediaPriorityShelf
        blocked={priorityBuckets.blocked}
        newItems={priorityBuckets.newItems}
        unused={priorityBuckets.unused}
      />
      <MediaLibraryToolbar
        page={mediaApi.page}
        pageSize={mediaApi.pageSize}
        total={mediaApi.total}
      />
      {mediaApi.assets.length > 0 ? (
        <MediaAssetGrid
          assets={mediaApi.assets}
          usageByAssetId={mediaApi.usageByAssetId}
          usageStatusByAssetId={mediaApi.usageStatusByAssetId}
        />
      ) : (
        <Alert>
          <AlertDescription>{t('media.empty.body')}</AlertDescription>
        </Alert>
      )}
    </section>
  );
};
