import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import { createDefaultMediaContent } from './poi.detail-form.defaults.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

const previewPanelClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20';

type MediaUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

const acceptedUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isSupportedUploadFile = (file: File): boolean => acceptedUploadMimeTypes.has(file.type);

const uploadPhaseMessageKey = (phase: MediaUploadPhase): string | null => {
  switch (phase) {
    case 'initializing':
      return 'messages.mediaUploadInitializing';
    case 'uploading':
      return 'messages.mediaUploadUploading';
    case 'finalizing':
      return 'messages.mediaUploadFinalizing';
    case 'success':
      return 'messages.mediaUploadSuccess';
    case 'error':
      return 'messages.mediaUploadError';
    case 'idle':
      return null;
  }
};

const readAssetTitle = (asset: HostMediaAssetListItem): string => {
  const title = asset.metadata?.title;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : asset.fileName?.trim() || asset.id;
};

const readAssetFileName = (asset: HostMediaAssetListItem): string => asset.fileName?.trim() || asset.id;

const readAssetCopyright = (asset: HostMediaAssetListItem): string => {
  const copyright = asset.metadata?.copyright;
  return typeof copyright === 'string' ? copyright.trim() : '';
};

const normalizeSearchValue = (value: string): string => value.trim().toLocaleLowerCase('de-DE');

const matchesAssetSearch = (asset: HostMediaAssetListItem, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  return normalizeSearchValue(readAssetTitle(asset)).includes(query) || normalizeSearchValue(readAssetFileName(asset)).includes(query);
};

const mediaContentTypeFromAsset = (asset: HostMediaAssetListItem): string => {
  const mimeType = asset.mimeType?.trim();
  if (!mimeType) {
    return '';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'attachement';
};

const mediaContentFromAsset = (asset: HostMediaAssetListItem) => ({
  captionText: readAssetTitle(asset),
  copyright: readAssetCopyright(asset),
  contentType: mediaContentTypeFromAsset(asset),
  sourceUrl: {
    url: asset.previewUrl ?? '',
    description: readAssetFileName(asset),
  },
});

const MediaPreview = ({ alt, url }: Readonly<{ alt: string; url: string }>) => {
  if (url.trim().length > 0) {
    return <img alt={alt} className="h-full w-full object-cover" loading="lazy" src={url} />;
  }

  return <span className="px-4 text-center text-sm text-muted-foreground">{alt}</span>;
};

export function PoiDetailMediaTab({
  mediaAssets,
  onUploadFile,
  pt,
}: Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  pt: (key: string) => string;
}>) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.mediaContents' });
  const mediaContents = useWatch({ control, name: 'content.mediaContents' }) ?? [];
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadPhase, setUploadPhase] = React.useState<MediaUploadPhase>('idle');
  const [uploadErrorKey, setUploadErrorKey] = React.useState<string | null>(null);
  const uploadMessageKey = uploadErrorKey ?? uploadPhaseMessageKey(uploadPhase);
  const uploadBusy = uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';

  const filteredAssets = React.useMemo(() => {
    const query = normalizeSearchValue(searchValue);
    return mediaAssets.filter((asset) => matchesAssetSearch(asset, query));
  }, [mediaAssets, searchValue]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setSearchValue('');
  }, []);

  const handleSelectAsset = React.useCallback(
    (asset: HostMediaAssetListItem) => {
      append(mediaContentFromAsset(asset));
      closeDialog();
    },
    [append, closeDialog]
  );

  const handleUploadChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      if (!isSupportedUploadFile(file)) {
        setUploadPhase('error');
        setUploadErrorKey('messages.mediaUploadUnsupportedType');
        return;
      }

      setUploadPhase('initializing');
      setUploadErrorKey(null);
      try {
        setUploadPhase('uploading');
        const asset = await onUploadFile(file);
        setUploadPhase('finalizing');
        append(mediaContentFromAsset(asset));
        setUploadPhase('success');
      } catch {
        setUploadPhase('error');
        setUploadErrorKey('messages.mediaUploadError');
      }
    },
    [append, onUploadFile]
  );

  return (
    <PoiDetailSectionCard title={pt('cards.media.entries.title')} description={pt('cards.media.entries.description')}>
      <div className="space-y-5">
        {fields.map((field, index) => {
          const sourceUrlError = errors.content?.mediaContents?.[index]?.sourceUrl?.url;
          const media = mediaContents[index];
          const previewUrl = media?.sourceUrl?.url ?? '';
          const previewAlt = media?.captionText?.trim() || media?.sourceUrl?.description?.trim() || pt('fields.mediaCaption');

          return (
            <article key={field.id} className="grid gap-4 rounded-xl border border-border/60 p-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
              <div className={previewPanelClassName}>
                <MediaPreview alt={previewAlt} url={previewUrl} />
              </div>
              <div className="space-y-4">
                <StudioFieldGroup columns={2}>
                  <StudioField
                    id={`poi-media-url-${index}`}
                    label={pt('fields.url')}
                    error={sourceUrlError ? pt('validation.webUrls') : undefined}
                    errorId={`poi-media-url-${index}-error`}
                  >
                    <Input
                      id={`poi-media-url-${index}`}
                      aria-describedby={sourceUrlError ? `poi-media-url-${index}-error` : undefined}
                      aria-invalid={sourceUrlError ? true : undefined}
                      {...register(`content.mediaContents.${index}.sourceUrl.url`)}
                    />
                  </StudioField>
                  <StudioField id={`poi-media-url-description-${index}`} label={pt('fields.urlDescription')}>
                    <Input id={`poi-media-url-description-${index}`} {...register(`content.mediaContents.${index}.sourceUrl.description`)} />
                  </StudioField>
                  <StudioField id={`poi-media-caption-${index}`} label={pt('fields.mediaCaption')}>
                    <Input id={`poi-media-caption-${index}`} {...register(`content.mediaContents.${index}.captionText`)} />
                  </StudioField>
                  <StudioField id={`poi-media-copyright-${index}`} label={pt('fields.mediaCopyright')}>
                    <Input id={`poi-media-copyright-${index}`} {...register(`content.mediaContents.${index}.copyright`)} />
                  </StudioField>
                  <StudioField id={`poi-media-content-type-${index}`} label={pt('fields.mediaContentType')}>
                    <Input id={`poi-media-content-type-${index}`} {...register(`content.mediaContents.${index}.contentType`)} />
                  </StudioField>
                </StudioFieldGroup>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => remove(index)}>
                    {pt('actions.removeImage')}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            {pt('actions.addImage')}
          </Button>
          <input
            ref={uploadInputRef}
            aria-label={pt('actions.uploadMedia')}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void handleUploadChange(event)}
          />
          <Button type="button" variant="outline" disabled={uploadBusy} onClick={() => uploadInputRef.current?.click()}>
            {uploadBusy ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
          </Button>
          <Button type="button" variant="outline" onClick={() => append(createDefaultMediaContent())}>
            {pt('actions.addMediaManual')}
          </Button>
        </div>
        {uploadMessageKey ? (
          <p className={`text-sm font-medium ${uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {pt(uploadMessageKey)}
          </p>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true);
          } else {
            closeDialog();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{pt('cards.media.entries.title')}</DialogTitle>
            <DialogDescription>{pt('cards.media.entries.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-hidden">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="poi-media-library-search">
                {pt('fields.imageSearch')}
              </label>
              <Input id="poi-media-library-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
            </div>
            <div className="max-h-[55vh] overflow-y-auto pr-1">
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAssets.map((asset) => (
                    <article key={asset.id} className="space-y-3 rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                      <div className={previewPanelClassName}>
                        <MediaPreview alt={readAssetTitle(asset)} url={asset.previewUrl ?? ''} />
                      </div>
                      <div className="space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">{readAssetTitle(asset)}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{readAssetFileName(asset)}</p>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" onClick={() => handleSelectAsset(asset)}>
                          {pt('actions.selectImage')}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  {pt('messages.imagePickerEmpty')}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PoiDetailSectionCard>
  );
}
