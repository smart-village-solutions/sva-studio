import React from 'react';

import { Button } from './button.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog.js';
import { Input } from './input.js';
import { MediaIntakePanel } from './media-intake-panel.js';
import { Textarea } from './textarea.js';

export type StudioMediaPickerMode = 'library' | 'upload' | 'review';
export type StudioMediaPickerReviewSource = 'library' | 'upload';
export type StudioMediaPickerUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';
export type StudioMediaPickerErrorCode =
  | 'unsupported_upload_type'
  | 'upload_failed'
  | 'asset_load_failed'
  | 'asset_unavailable'
  | 'metadata_save_failed';

export type StudioMediaPickerMetadataDraft = Readonly<{
  title: string;
  altText: string;
  description: string;
  copyright: string;
  license: string;
}>;

export type StudioMediaPickerAssetSummary = Readonly<{
  id: string;
  title: string;
  fileName: string;
  previewUrl?: string | null;
  mimeType?: string;
  visibility?: string;
}>;

export type StudioMediaPickerAssetDetail = StudioMediaPickerAssetSummary & Readonly<{
  metadata: StudioMediaPickerMetadataDraft;
}>;

export type StudioMediaPickerOverlayLabels = Readonly<{
  title: string;
  description: string;
  modes: Readonly<{
    library: string;
    upload: string;
    review: string;
  }>;
  library: Readonly<{
    searchLabel: string;
    empty: string;
    select: string;
  }>;
  upload: Readonly<{
    regionLabel: string;
    title: string;
    description: string;
    browseAction: string;
    supportLabel: string;
  }>;
  review: Readonly<{
    title: string;
    description: string;
  }>;
  fields: Readonly<{
    title: string;
    altText: string;
    description: string;
    copyright: string;
    license: string;
  }>;
  actions: Readonly<{
    cancel: string;
    backToLibrary: string;
    backToUpload: string;
    openMediaManagement: string;
    useMedia: string;
  }>;
}>;

type UseStudioMediaPickerOverlayOptions<TAssetDetail extends StudioMediaPickerAssetDetail> = Readonly<{
  onAccept: (asset: TAssetDetail) => void;
  isSupportedUploadFile: (file: File) => boolean;
  uploadAsset: (file: File) => Promise<{ readonly assetId: string }>;
  loadAsset: (assetId: string) => Promise<TAssetDetail>;
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataDraft) => Promise<TAssetDetail>;
  canAcceptAsset?: (asset: TAssetDetail) => boolean;
}>;

const createMetadataDraft = (asset: Pick<StudioMediaPickerAssetDetail, 'metadata' | 'title'>): StudioMediaPickerMetadataDraft => ({
  title: asset.metadata.title || asset.title || '',
  altText: asset.metadata.altText || '',
  description: asset.metadata.description || '',
  copyright: asset.metadata.copyright || '',
  license: asset.metadata.license || '',
});

export const useStudioMediaPickerOverlay = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  isSupportedUploadFile,
  loadAsset,
  onAccept,
  saveAssetMetadata,
  uploadAsset,
}: UseStudioMediaPickerOverlayOptions<TAssetDetail>) => {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<StudioMediaPickerMode>('library');
  const [reviewSource, setReviewSource] = React.useState<StudioMediaPickerReviewSource>('library');
  const [searchValue, setSearchValue] = React.useState('');
  const [uploadPhase, setUploadPhase] = React.useState<StudioMediaPickerUploadPhase>('idle');
  const [errorCode, setErrorCode] = React.useState<StudioMediaPickerErrorCode | null>(null);
  const [reviewAsset, setReviewAsset] = React.useState<TAssetDetail | null>(null);
  const [metadataDraft, setMetadataDraft] = React.useState<StudioMediaPickerMetadataDraft>({
    title: '',
    altText: '',
    description: '',
    copyright: '',
    license: '',
  });
  const [isLoadingReviewAsset, setIsLoadingReviewAsset] = React.useState(false);
  const [isSavingReviewAsset, setIsSavingReviewAsset] = React.useState(false);

  const resetTransientState = React.useCallback(() => {
    setSearchValue('');
    setUploadPhase('idle');
    setErrorCode(null);
    setReviewAsset(null);
    setMetadataDraft({
      title: '',
      altText: '',
      description: '',
      copyright: '',
      license: '',
    });
    setIsLoadingReviewAsset(false);
    setIsSavingReviewAsset(false);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setMode('library');
    setReviewSource('library');
    resetTransientState();
  }, [resetTransientState]);

  const openLibrary = React.useCallback(() => {
    setOpen(true);
    setMode('library');
    setReviewSource('library');
    setErrorCode(null);
    setUploadPhase('idle');
  }, []);

  const openUpload = React.useCallback(() => {
    setOpen(true);
    setMode('upload');
    setReviewSource('upload');
    setErrorCode(null);
    setUploadPhase('idle');
  }, []);

  const loadReviewAsset = React.useCallback(
    async (assetId: string, source: StudioMediaPickerReviewSource) => {
      setIsLoadingReviewAsset(true);
      setErrorCode(null);
      try {
        const asset = await loadAsset(assetId);
        setReviewAsset(asset);
        setMetadataDraft(createMetadataDraft(asset));
        setReviewSource(source);
        setMode('review');
      } catch {
        setErrorCode('asset_load_failed');
      } finally {
        setIsLoadingReviewAsset(false);
      }
    },
    [loadAsset]
  );

  const selectAsset = React.useCallback(
    async (asset: StudioMediaPickerAssetSummary) => {
      await loadReviewAsset(asset.id, 'library');
    },
    [loadReviewAsset]
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      if (!isSupportedUploadFile(file)) {
        setErrorCode('unsupported_upload_type');
        setUploadPhase('error');
        return;
      }

      setUploadPhase('initializing');
      setErrorCode(null);

      try {
        setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        setUploadPhase('finalizing');
        await loadReviewAsset(uploaded.assetId, 'upload');
        setUploadPhase('success');
      } catch {
        setUploadPhase('error');
        setErrorCode('upload_failed');
      }
    },
    [isSupportedUploadFile, loadReviewAsset, uploadAsset]
  );

  const updateMetadataField = React.useCallback(
    <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => {
      setMetadataDraft((current) => ({
        ...current,
        [key]: value,
      }));
      setErrorCode(null);
    },
    []
  );

  const goBackFromReview = React.useCallback(() => {
    setMode(reviewSource);
    setErrorCode(null);
  }, [reviewSource]);

  const confirmSelection = React.useCallback(async () => {
    if (!reviewAsset) {
      return;
    }

    setIsSavingReviewAsset(true);
    setErrorCode(null);

    try {
      const updatedAsset = await saveAssetMetadata(reviewAsset.id, metadataDraft);
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        setReviewAsset(updatedAsset);
        setMetadataDraft(createMetadataDraft(updatedAsset));
        setErrorCode('asset_unavailable');
        return;
      }
      setReviewAsset(updatedAsset);
      setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      close();
    } catch {
      setErrorCode('metadata_save_failed');
    } finally {
      setIsSavingReviewAsset(false);
    }
  }, [canAcceptAsset, close, metadataDraft, onAccept, reviewAsset, saveAssetMetadata]);

  return {
    open,
    mode,
    reviewSource,
    searchValue,
    setSearchValue,
    uploadPhase,
    errorCode,
    reviewAsset,
    metadataDraft,
    isLoadingReviewAsset,
    isSavingReviewAsset,
    close,
    openLibrary,
    openUpload,
    selectAsset,
    uploadFile,
    updateMetadataField,
    goBackFromReview,
    confirmSelection,
  } as const;
};

type StudioMediaPickerOverlayProps = Readonly<{
  open: boolean;
  mode: StudioMediaPickerMode;
  reviewSource: StudioMediaPickerReviewSource;
  assets: readonly StudioMediaPickerAssetSummary[];
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onClose: () => void;
  onChangeMode: (mode: 'library' | 'upload') => void;
  onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
  uploadPhase: StudioMediaPickerUploadPhase;
  onUploadFile: (file: File) => void | Promise<void>;
  isSupportedUploadFile: (file: File) => boolean;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: <Key extends keyof StudioMediaPickerMetadataDraft>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => void;
  onBackFromReview: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  labels: StudioMediaPickerOverlayLabels;
}>;

const normalizeSearchValue = (value: string) => value.trim().toLocaleLowerCase('de-DE');

const previewClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20';

const MediaPreview = ({ alt, url }: Readonly<{ alt: string; url?: string | null }>) =>
  url ? (
    <img alt={alt} className="h-full w-full object-cover" src={url} />
  ) : (
    <div className="px-4 text-center text-sm text-muted-foreground">{alt}</div>
  );

export const StudioMediaPickerOverlay = ({
  assets,
  feedbackMessage,
  feedbackTone = 'default',
  isAssetSelectable,
  isLoadingReviewAsset = false,
  isSavingReviewAsset = false,
  isSupportedUploadFile,
  labels,
  metadataDraft,
  mode,
  onBackFromReview,
  onChangeMode,
  onClose,
  onConfirmSelection,
  onMetadataChange,
  onOpenMediaManagement,
  onSearchValueChange,
  onSelectAsset,
  onUploadFile,
  open,
  reviewAsset,
  reviewSource,
  searchValue,
  uploadPhase,
}: StudioMediaPickerOverlayProps) => {
  const query = normalizeSearchValue(searchValue);
  const filteredAssets = assets.filter((asset) => {
    if (query.length === 0) {
      return true;
    }
    return normalizeSearchValue(asset.title).includes(query) || normalizeSearchValue(asset.fileName).includes(query);
  });

  const feedbackClassName =
    feedbackTone === 'error'
      ? 'text-destructive'
      : feedbackTone === 'success'
        ? 'text-foreground'
        : 'text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1080px)] max-w-none overflow-hidden">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
          <Button
            type="button"
            variant={mode === 'library' ? 'default' : 'outline'}
            onClick={() => onChangeMode('library')}
          >
            {labels.modes.library}
          </Button>
          <Button
            type="button"
            variant={mode === 'upload' ? 'default' : 'outline'}
            onClick={() => onChangeMode('upload')}
          >
            {labels.modes.upload}
          </Button>
          {mode === 'review' ? (
            <Button type="button" variant="secondary" disabled>
              {labels.modes.review}
            </Button>
          ) : null}
        </div>

        <div className="max-h-[72vh] overflow-y-auto pr-1">
          {mode === 'library' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="studio-media-picker-search">
                  {labels.library.searchLabel}
                </label>
                <Input
                  id="studio-media-picker-search"
                  value={searchValue}
                  onChange={(event) => onSearchValueChange(event.target.value)}
                />
              </div>
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const selectable = isAssetSelectable ? isAssetSelectable(asset) : true;
                    return (
                      <article key={asset.id} className="space-y-3 rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                        <div className={previewClassName}>
                          <MediaPreview alt={asset.title} url={asset.previewUrl} />
                        </div>
                        <div className="space-y-1">
                          <p className="line-clamp-1 text-sm font-semibold text-foreground">{asset.title}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{asset.fileName}</p>
                        </div>
                        <div className="flex justify-end">
                          <Button type="button" disabled={!selectable} onClick={() => void onSelectAsset(asset)}>
                            {labels.library.select}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  {labels.library.empty}
                </div>
              )}
            </div>
          ) : null}

          {mode === 'upload' ? (
            <MediaIntakePanel
              accept="image/jpeg,image/png,image/webp"
              browseActionLabel={labels.upload.browseAction}
              description={labels.upload.description}
              inputTestId="media-upload-input"
              isSupportedUploadFile={isSupportedUploadFile}
              onFileSelected={(file) => void onUploadFile(file)}
              phase={uploadPhase}
              regionLabel={labels.upload.regionLabel}
              statusMessage={feedbackMessage}
              statusTone={feedbackTone}
              supportLabel={labels.upload.supportLabel}
              title={labels.upload.title}
            />
          ) : null}

          {mode === 'review' ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{labels.review.title}</h3>
                <p className="text-sm text-muted-foreground">{labels.review.description}</p>
              </div>

              {feedbackMessage ? <p className={`text-sm font-medium ${feedbackClassName}`}>{feedbackMessage}</p> : null}

              {isLoadingReviewAsset || !reviewAsset ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  {labels.review.description}
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-4">
                    <div className={previewClassName}>
                      <MediaPreview alt={reviewAsset.title} url={reviewAsset.previewUrl} />
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{reviewAsset.title}</p>
                      <p className="text-xs text-muted-foreground">{reviewAsset.fileName}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="studio-media-review-title">
                        {labels.fields.title}
                      </label>
                      <Input
                        id="studio-media-review-title"
                        value={metadataDraft.title}
                        onChange={(event) => onMetadataChange('title', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="studio-media-review-alt-text">
                        {labels.fields.altText}
                      </label>
                      <Input
                        id="studio-media-review-alt-text"
                        value={metadataDraft.altText}
                        onChange={(event) => onMetadataChange('altText', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="studio-media-review-description">
                        {labels.fields.description}
                      </label>
                      <Textarea
                        id="studio-media-review-description"
                        value={metadataDraft.description}
                        onChange={(event) => onMetadataChange('description', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="studio-media-review-copyright">
                        {labels.fields.copyright}
                      </label>
                      <Input
                        id="studio-media-review-copyright"
                        value={metadataDraft.copyright}
                        onChange={(event) => onMetadataChange('copyright', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="studio-media-review-license">
                        {labels.fields.license}
                      </label>
                      <Input
                        id="studio-media-review-license"
                        value={metadataDraft.license}
                        onChange={(event) => onMetadataChange('license', event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={onBackFromReview}>
                    {reviewSource === 'library' ? labels.actions.backToLibrary : labels.actions.backToUpload}
                  </Button>
                  {reviewAsset && onOpenMediaManagement ? (
                    <Button type="button" variant="outline" onClick={() => void onOpenMediaManagement(reviewAsset.id)}>
                      {labels.actions.openMediaManagement}
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={onClose}>
                    {labels.actions.cancel}
                  </Button>
                  <Button type="button" disabled={isLoadingReviewAsset || isSavingReviewAsset || !reviewAsset} onClick={() => void onConfirmSelection()}>
                    {labels.actions.useMedia}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
