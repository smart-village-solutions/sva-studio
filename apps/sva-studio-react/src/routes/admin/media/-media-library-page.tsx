import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button, StudioPageTitle } from '@sva/studio-ui-react';
import { useMediaLibrary, useSingleFileMediaUpload } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../../lib/studio-permission-denial-message';
import { useAccessDecision } from '../../../providers/effective-access-provider';

import { MediaAssetGrid } from './-media-asset-grid.js';
import { MediaInventoryScanSection } from './-media-inventory-scan-section.js';
import { MediaIntakeShelf } from './-media-intake-shelf.js';
import { MediaLibraryToolbar } from './-media-library-toolbar.js';

const mediaErrorMessage = (error: IamHttpError | null): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
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
  const createDecision = useAccessDecision({
    kind: 'tenant',
    moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.create'] },
  });
  const scanDecision = useAccessDecision({
    kind: 'tenant', moduleId: 'media',
    actions: { mode: 'allOf', values: ['media.read', 'media.update'] },
  });
  const canCreateMedia = createDecision.status === 'allowed';
  const navigate = useNavigate();
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = React.useState<readonly (string | undefined)[]>([]);
  const [limit, setLimit] = React.useState(36);
  const [filters, setFilters] = React.useState({ search: '', tag: '' });
  const mediaApi = useMediaLibrary({
    cursor,
    limit,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.tag ? { tag: filters.tag } : {}),
  });
  const singleFileUpload = useSingleFileMediaUpload();

  const handleFileSelected = React.useCallback(
    async (file: File) => {
      const result = await singleFileUpload.uploadFile(file);
      if (!result) {
        await mediaApi.refetch();
        return;
      }

      await navigate({
        to: '/admin/media/$mediaId',
        params: { mediaId: result.assetId },
      });
    },
    [navigate, singleFileUpload, mediaApi.refetch]
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
          <StudioPageTitle withAccessory>{t('media.page.title')}</StudioPageTitle>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('media.page.subtitle')}</p>
        </div>
        {canCreateMedia ? (
          <Button asChild>
            <Link to="/admin/media/new">{t('media.actions.create')}</Link>
          </Button>
        ) : null}
      </header>

      {canCreateMedia ? (
        <MediaIntakeShelf
          error={singleFileUpload.error}
          phase={singleFileUpload.phase}
          onFileSelected={(file) => {
            void handleFileSelected(file);
          }}
        />
      ) : null}
      <form
        key={JSON.stringify(filters)}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setCursor(undefined);
          setCursorHistory([]);
          setFilters({
            search: String(data.get('search') ?? '').trim(),
            tag: String(data.get('tag') ?? '').trim(),
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="media-search">{t('media.filters.searchLabel')}</Label>
          <Input id="media-search" name="search" defaultValue={filters.search} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="media-tag-filter">{t('media.fields.tags')}</Label>
          <Input id="media-tag-filter" name="tag" maxLength={64} defaultValue={filters.tag} />
        </div>
        <Button type="submit">{t('media.filters.apply')}</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.currentTarget.form?.reset();
            setCursor(undefined);
            setCursorHistory([]);
            setFilters({ search: '', tag: '' });
          }}
        >
          {t('media.filters.clear')}
        </Button>
      </form>
      {scanDecision.status === 'allowed' ? <MediaInventoryScanSection /> : null}
      <MediaLibraryToolbar
        page={cursorHistory.length + 1}
        limit={mediaApi.limit}
        itemCount={mediaApi.assets.length}
        canGoBack={cursorHistory.length > 0}
        canGoForward={mediaApi.hasNextPage && mediaApi.nextCursor !== null}
        onPrevious={() => {
          const previousCursor = cursorHistory.at(-1);
          setCursorHistory((current) => current.slice(0, -1));
          setCursor(previousCursor);
        }}
        onNext={() => {
          if (!mediaApi.nextCursor) return;
          setCursorHistory((current) => [...current, cursor]);
          setCursor(mediaApi.nextCursor ?? undefined);
        }}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setCursor(undefined);
          setCursorHistory([]);
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
