import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useCreateMediaUpload, useMediaDetail, useMediaLibrary } from '../../../hooks/use-media';
import { t } from '../../../i18n';
import type { IamHttpError, IamMediaAsset, MediaProcessingStatus, MediaUploadStatus, MediaVisibility } from '../../../lib/iam-api';

type MediaLibraryFilter = 'all' | 'public' | 'protected';

const visibilityVariantByValue: Record<MediaVisibility, 'default' | 'secondary'> = {
  public: 'default',
  protected: 'secondary',
};

const uploadStatusVariantByValue: Record<MediaUploadStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  validated: 'outline',
  processed: 'default',
  failed: 'destructive',
  blocked: 'destructive',
};

const processingStatusVariantByValue: Record<MediaProcessingStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  ready: 'default',
  failed: 'destructive',
};

const mediaErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('media.messages.loadError');
  }

  if (error.safeDetails?.reason_code === 'active_references') {
    return t('media.errors.activeReferences');
  }

  switch (error.code) {
    case 'forbidden':
      return t('media.errors.forbidden');
    case 'database_unavailable':
      return t('media.errors.databaseUnavailable');
    case 'not_found':
      return t('media.errors.notFound');
    case 'conflict':
      return t('media.errors.conflict');
    default:
      return t('media.messages.loadError');
  }
};

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('media.values.notAvailable');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatByteSize = (value: number): string => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatAssetLabel = (asset: IamMediaAsset): string =>
  asset.metadata.title?.trim() || asset.metadata.altText?.trim() || asset.id;

const mediaVisibilityKeyByValue: Record<MediaVisibility, 'media.visibility.public' | 'media.visibility.protected'> = {
  public: 'media.visibility.public',
  protected: 'media.visibility.protected',
};

const mediaUploadStatusKeyByValue: Record<MediaUploadStatus, `media.uploadStatus.${MediaUploadStatus}`> = {
  pending: 'media.uploadStatus.pending',
  validated: 'media.uploadStatus.validated',
  processed: 'media.uploadStatus.processed',
  failed: 'media.uploadStatus.failed',
  blocked: 'media.uploadStatus.blocked',
};

const mediaProcessingStatusKeyByValue: Record<MediaProcessingStatus, `media.processingStatus.${MediaProcessingStatus}`> = {
  pending: 'media.processingStatus.pending',
  ready: 'media.processingStatus.ready',
  failed: 'media.processingStatus.failed',
};

const mediaRoleKeyByValue = {
  thumbnail: 'media.roles.thumbnail',
  teaser_image: 'media.roles.teaser_image',
  header_image: 'media.roles.header_image',
  gallery_item: 'media.roles.gallery_item',
  download: 'media.roles.download',
  hero_image: 'media.roles.hero_image',
} as const;

const formatMediaRole = (role: string): string =>
  role in mediaRoleKeyByValue ? t(mediaRoleKeyByValue[role as keyof typeof mediaRoleKeyByValue]) : role;

const MediaLibraryPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const [search, setSearch] = React.useState('');
  const [visibility, setVisibility] = React.useState<MediaLibraryFilter>('all');
  const mediaApi = useMediaLibrary({ search: search.trim() || undefined, visibility });

  const columns = React.useMemo<readonly StudioColumnDef<IamMediaAsset>[]>(
    () => [
      {
        id: 'title',
        header: t('media.table.headerTitle'),
        cell: (asset) => <span className="font-medium text-foreground">{formatAssetLabel(asset)}</span>,
        sortable: true,
        sortValue: (asset) => formatAssetLabel(asset).toLowerCase(),
      },
      {
        id: 'mimeType',
        header: t('media.table.headerMimeType'),
        cell: (asset) => asset.mimeType,
        sortable: true,
        sortValue: (asset) => asset.mimeType,
      },
      {
        id: 'byteSize',
        header: t('media.table.headerSize'),
        cell: (asset) => formatByteSize(asset.byteSize),
        sortable: true,
        sortValue: (asset) => asset.byteSize,
      },
      {
        id: 'visibility',
        header: t('media.table.headerVisibility'),
        cell: (asset) => <Badge variant={visibilityVariantByValue[asset.visibility]}>{t(mediaVisibilityKeyByValue[asset.visibility])}</Badge>,
        sortable: true,
        sortValue: (asset) => asset.visibility,
      },
      {
        id: 'uploadStatus',
        header: t('media.table.headerUploadStatus'),
        cell: (asset) => (
          <Badge variant={uploadStatusVariantByValue[asset.uploadStatus]}>
            {t(mediaUploadStatusKeyByValue[asset.uploadStatus])}
          </Badge>
        ),
        sortable: true,
        sortValue: (asset) => asset.uploadStatus,
      },
      {
        id: 'updatedAt',
        header: t('media.table.headerUpdatedAt'),
        cell: (asset) => formatDateTime(asset.updatedAt),
        sortable: true,
        sortValue: (asset) => asset.updatedAt ?? '',
      },
      {
        id: 'actions',
        header: t('media.table.headerActions'),
        cell: (asset) => (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/media/$mediaId" params={{ mediaId: asset.id }}>
              {t('media.actions.open')}
            </Link>
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <StudioListPageTemplate
      title={t('media.page.title')}
      description={t('media.page.subtitle')}
      primaryAction={{
        label: t('media.actions.create'),
        render: (
          <Button asChild>
            <Link to="/admin/media/new">{t('media.actions.create')}</Link>
          </Button>
        ),
      }}
    >
      <div className="space-y-4">
        {mediaApi.error ? (
          <Alert className="border-destructive/40 text-destructive">
            <AlertDescription>{mediaErrorMessage(mediaApi.error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="media-search">{t('media.filters.searchLabel')}</Label>
            <Input
              id="media-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('media.filters.searchPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="media-visibility">{t('media.filters.visibilityLabel')}</Label>
            <Select
              id="media-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as MediaLibraryFilter)}
            >
                  <option value="all">{t('media.filters.visibilityAll')}</option>
              <option value="public">{t(mediaVisibilityKeyByValue.public)}</option>
              <option value="protected">{t(mediaVisibilityKeyByValue.protected)}</option>
            </Select>
          </div>
        </div>

        {mediaApi.isLoading ? <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p> : null}

        <StudioDataTable
          ariaLabel={t('media.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('media.table.caption')}
          columns={columns}
          data={mediaApi.assets}
          emptyState={<p className="text-sm text-muted-foreground">{t('media.empty.body')}</p>}
          getRowId={(asset) => asset.id}
        />

        {!mediaApi.isLoading && mediaApi.assets.length === 0 ? (
          <Alert>
            <AlertDescription>{t('media.empty.body')}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </StudioListPageTemplate>
  );
};

const MediaCreatePage = () => {
  const uploadApi = useCreateMediaUpload();
  const [mimeType, setMimeType] = React.useState('image/jpeg');
  const [byteSize, setByteSize] = React.useState('512000');
  const [visibility, setVisibility] = React.useState<MediaVisibility>('public');
  const [result, setResult] = React.useState<{
    assetId: string;
    uploadSessionId: string;
    uploadUrl: string;
    expiresAt: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedByteSize = Number(byteSize);
    if (!Number.isFinite(parsedByteSize) || parsedByteSize <= 0) {
      return;
    }

    const response = await uploadApi.initializeUpload({
      mimeType,
      byteSize: parsedByteSize,
      visibility,
    });
    if (response) {
      setResult({
        assetId: response.assetId,
        uploadSessionId: response.uploadSessionId,
        uploadUrl: response.uploadUrl,
        expiresAt: response.expiresAt,
      });
    }
  };

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('media.editor.createTitle')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('media.editor.createSubtitle')}</p>
      </header>

      {uploadApi.mutationError ? (
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{mediaErrorMessage(uploadApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('media.editor.uploadCardTitle')}</CardTitle>
          <CardDescription>{t('media.editor.uploadCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="media-mime-type">{t('media.fields.mimeType')}</Label>
                <Input id="media-mime-type" value={mimeType} onChange={(event) => setMimeType(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-byte-size">{t('media.fields.byteSize')}</Label>
                <Input
                  id="media-byte-size"
                  type="number"
                  min="1"
                  value={byteSize}
                  onChange={(event) => setByteSize(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-create-visibility">{t('media.fields.visibility')}</Label>
              <Select
                id="media-create-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as MediaVisibility)}
              >
                <option value="public">{t('media.visibility.public')}</option>
                <option value="protected">{t('media.visibility.protected')}</option>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button type="submit">{t('media.actions.initializeUpload')}</Button>
              <Button asChild type="button" variant="outline">
                <Link to="/admin/media">{t('media.actions.back')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('media.editor.uploadReadyTitle')}</CardTitle>
            <CardDescription>{t('media.editor.uploadReadyDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{t('media.meta.id')}: {result.assetId}</p>
            <p>{t('media.meta.uploadSessionId')}: {result.uploadSessionId}</p>
            <p>{t('media.meta.expiresAt')}: {formatDateTime(result.expiresAt)}</p>
            <p className="break-all">{t('media.meta.uploadUrl')}: {result.uploadUrl}</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};

const MediaDetailPage = ({ assetId }: { assetId: string }) => {
  const navigate = useNavigate();
  const mediaApi = useMediaDetail(assetId);
  const [title, setTitle] = React.useState('');
  const [altText, setAltText] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [copyright, setCopyright] = React.useState('');
  const [license, setLicense] = React.useState('');
  const [visibility, setVisibility] = React.useState<MediaVisibility>('public');
  const [focusPointX, setFocusPointX] = React.useState('');
  const [focusPointY, setFocusPointY] = React.useState('');
  const [cropX, setCropX] = React.useState('');
  const [cropY, setCropY] = React.useState('');
  const [cropWidth, setCropWidth] = React.useState('');
  const [cropHeight, setCropHeight] = React.useState('');

  React.useEffect(() => {
    if (!mediaApi.asset) {
      return;
    }

    setTitle(mediaApi.asset.metadata.title ?? '');
    setAltText(mediaApi.asset.metadata.altText ?? '');
    setDescription(mediaApi.asset.metadata.description ?? '');
    setCopyright(mediaApi.asset.metadata.copyright ?? '');
    setLicense(mediaApi.asset.metadata.license ?? '');
    setVisibility(mediaApi.asset.visibility);
    setFocusPointX(mediaApi.asset.metadata.focusPoint?.x?.toString() ?? '');
    setFocusPointY(mediaApi.asset.metadata.focusPoint?.y?.toString() ?? '');
    setCropX(mediaApi.asset.metadata.crop?.x?.toString() ?? '');
    setCropY(mediaApi.asset.metadata.crop?.y?.toString() ?? '');
    setCropWidth(mediaApi.asset.metadata.crop?.width?.toString() ?? '');
    setCropHeight(mediaApi.asset.metadata.crop?.height?.toString() ?? '');
  }, [mediaApi.asset]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedFocusPointX = focusPointX.trim().length > 0 ? Number(focusPointX) : undefined;
    const parsedFocusPointY = focusPointY.trim().length > 0 ? Number(focusPointY) : undefined;
    const parsedCropX = cropX.trim().length > 0 ? Number(cropX) : undefined;
    const parsedCropY = cropY.trim().length > 0 ? Number(cropY) : undefined;
    const parsedCropWidth = cropWidth.trim().length > 0 ? Number(cropWidth) : undefined;
    const parsedCropHeight = cropHeight.trim().length > 0 ? Number(cropHeight) : undefined;

    await mediaApi.updateMedia({
      visibility,
      metadata: {
        title: title.trim() || undefined,
        altText: altText.trim() || undefined,
        description: description.trim() || undefined,
        copyright: copyright.trim() || undefined,
        license: license.trim() || undefined,
        focusPoint:
          Number.isFinite(parsedFocusPointX) && Number.isFinite(parsedFocusPointY)
            ? {
                x: parsedFocusPointX as number,
                y: parsedFocusPointY as number,
              }
            : undefined,
        crop:
          Number.isFinite(parsedCropX) &&
          Number.isFinite(parsedCropY) &&
          Number.isFinite(parsedCropWidth) &&
          Number.isFinite(parsedCropHeight) &&
          (parsedCropWidth as number) > 0 &&
          (parsedCropHeight as number) > 0
            ? {
                x: parsedCropX as number,
                y: parsedCropY as number,
                width: parsedCropWidth as number,
                height: parsedCropHeight as number,
              }
            : undefined,
      },
    });
  };

  const handleResolveDelivery = async () => {
    const delivery = await mediaApi.resolveDelivery();
    if (delivery?.deliveryUrl) {
      globalThis.window?.open(delivery.deliveryUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = async () => {
    if (!mediaApi.asset || !globalThis.confirm(t('media.actions.deleteConfirm'))) {
      return;
    }

    const deleted = await mediaApi.deleteMedia();
    if (deleted) {
      await navigate({ to: '/admin/media' });
    }
  };

  if (mediaApi.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('media.messages.loading')}</p>;
  }

  if (!mediaApi.asset) {
    return (
      <Alert className="border-destructive/40 text-destructive">
        <AlertDescription>{mediaErrorMessage(mediaApi.error)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('media.editor.detailTitle')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('media.editor.detailSubtitle')}</p>
      </header>

      {mediaApi.mutationError ? (
        <Alert className="border-destructive/40 text-destructive">
          <AlertDescription>{mediaErrorMessage(mediaApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('media.editor.metadataTitle')}</CardTitle>
            <CardDescription>{t('media.editor.metadataDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-title">{t('media.fields.title')}</Label>
                  <Input id="media-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-alt-text">{t('media.fields.altText')}</Label>
                  <Input id="media-alt-text" value={altText} onChange={(event) => setAltText(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-description">{t('media.fields.description')}</Label>
                <Textarea id="media-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-copyright">{t('media.fields.copyright')}</Label>
                  <Input id="media-copyright" value={copyright} onChange={(event) => setCopyright(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-license">{t('media.fields.license')}</Label>
                  <Input id="media-license" value={license} onChange={(event) => setLicense(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-detail-visibility">{t('media.fields.visibility')}</Label>
                <Select
                  id="media-detail-visibility"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as MediaVisibility)}
                >
                  <option value="public">{t(mediaVisibilityKeyByValue.public)}</option>
                  <option value="protected">{t(mediaVisibilityKeyByValue.protected)}</option>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-focus-point-x">{t('media.fields.focusPointX')}</Label>
                  <Input
                    id="media-focus-point-x"
                    type="number"
                    step="0.01"
                    value={focusPointX}
                    onChange={(event) => setFocusPointX(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-focus-point-y">{t('media.fields.focusPointY')}</Label>
                  <Input
                    id="media-focus-point-y"
                    type="number"
                    step="0.01"
                    value={focusPointY}
                    onChange={(event) => setFocusPointY(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="media-crop-x">{t('media.fields.cropX')}</Label>
                  <Input id="media-crop-x" type="number" step="1" value={cropX} onChange={(event) => setCropX(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-crop-y">{t('media.fields.cropY')}</Label>
                  <Input id="media-crop-y" type="number" step="1" value={cropY} onChange={(event) => setCropY(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-crop-width">{t('media.fields.cropWidth')}</Label>
                  <Input
                    id="media-crop-width"
                    type="number"
                    step="1"
                    min="1"
                    value={cropWidth}
                    onChange={(event) => setCropWidth(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-crop-height">{t('media.fields.cropHeight')}</Label>
                  <Input
                    id="media-crop-height"
                    type="number"
                    step="1"
                    min="1"
                    value={cropHeight}
                    onChange={(event) => setCropHeight(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit">{t('media.actions.save')}</Button>
                <Button asChild type="button" variant="outline">
                  <Link to="/admin/media/$mediaId/usage" params={{ mediaId: mediaApi.asset.id }}>
                    {t('media.actions.openUsage')}
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleResolveDelivery()}>
                  {t('media.actions.resolveDelivery')}
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleDelete()}>
                  {t('media.actions.delete')}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to="/admin/media">{t('media.actions.back')}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('media.meta.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{t('media.meta.id')}: {mediaApi.asset.id}</p>
              <p>{t('media.meta.mimeType')}: {mediaApi.asset.mimeType}</p>
              <p>{t('media.meta.byteSize')}: {formatByteSize(mediaApi.asset.byteSize)}</p>
              <p>{t('media.meta.createdAt')}: {formatDateTime(mediaApi.asset.createdAt)}</p>
              <p>{t('media.meta.updatedAt')}: {formatDateTime(mediaApi.asset.updatedAt)}</p>
              <div className="flex items-center gap-2">
                {t('media.meta.uploadStatus')}:{' '}
                <Badge variant={uploadStatusVariantByValue[mediaApi.asset.uploadStatus]}>
                  {t(mediaUploadStatusKeyByValue[mediaApi.asset.uploadStatus])}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {t('media.meta.processingStatus')}:{' '}
                <Badge variant={processingStatusVariantByValue[mediaApi.asset.processingStatus]}>
                  {t(mediaProcessingStatusKeyByValue[mediaApi.asset.processingStatus])}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('media.usage.title')}</CardTitle>
              <CardDescription>{t('media.usage.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('media.usage.summary', { count: mediaApi.usage?.totalReferences ?? 0 })}
              </p>
              {mediaApi.usage?.references.length ? (
                <ul className="space-y-2 text-sm">
                  {mediaApi.usage.references.map((reference) => (
                    <li key={reference.id} className="rounded-md border p-3">
                      <p className="font-medium text-foreground">{reference.targetType}</p>
                      <p className="text-muted-foreground">{reference.targetId}</p>
                      <p className="text-muted-foreground">{formatMediaRole(reference.role)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('media.usage.empty')}</p>
              )}
              {mediaApi.delivery ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-foreground">{t('media.delivery.title')}</p>
                  <p className="break-all text-muted-foreground">{mediaApi.delivery.deliveryUrl}</p>
                  <p className="text-muted-foreground">
                    {t('media.delivery.expiresAt', { value: formatDateTime(mediaApi.delivery.expiresAt) })}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export const MediaPage = () => {
  const location = useLocation();
  const params = useParams({ strict: false });
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : null;

  if (mediaId) {
    return <MediaDetailPage assetId={mediaId} />;
  }

  if (location.pathname.endsWith('/new')) {
    return <MediaCreatePage />;
  }

  return <MediaLibraryPage />;
};
