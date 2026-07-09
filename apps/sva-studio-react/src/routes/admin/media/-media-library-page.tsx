import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { useMediaLibrary, useSingleFileMediaUpload } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

import { MediaAssetGrid } from './-media-asset-grid.js';
import { MediaIntakeShelf } from './-media-intake-shelf.js';
import { MediaLibraryToolbar } from './-media-library-toolbar.js';

const isSupportedMediaLibraryUploadFile = (file: File) =>
  file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';

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
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(36);
  const [clientUploadErrorCode, setClientUploadErrorCode] = React.useState<'unsupported_upload_type' | null>(null);
  const mediaApi = useMediaLibrary({ page, pageSize });
  const singleFileUpload = useSingleFileMediaUpload();
  const totalPages = Math.max(1, Math.ceil(mediaApi.total / Math.max(1, mediaApi.pageSize)));

  const handleFileSelected = React.useCallback(
    async (file: File) => {
      if (!isSupportedMediaLibraryUploadFile(file)) {
        setClientUploadErrorCode('unsupported_upload_type');
        return;
      }

      setClientUploadErrorCode(null);
      const result = await singleFileUpload.uploadFile(file);
      if (!result) {
        return;
      }

      await navigate({
        to: '/admin/media/$mediaId',
        params: { mediaId: result.assetId },
      });
    },
    [navigate, singleFileUpload]
  );

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

      <MediaIntakeShelf
        error={clientUploadErrorCode ? { code: clientUploadErrorCode } : singleFileUpload.error}
        phase={clientUploadErrorCode ? 'error' : singleFileUpload.phase}
        onFileSelected={(file) => {
          void handleFileSelected(file);
        }}
      />
      <MediaLibraryToolbar
        page={mediaApi.page}
        pageCount={totalPages}
        pageSize={mediaApi.pageSize}
        total={mediaApi.total}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
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
