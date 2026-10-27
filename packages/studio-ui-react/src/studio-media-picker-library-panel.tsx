import { Button } from './button.js';
import { Input } from './input.js';
import * as React from 'react';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { listHostMediaAssets } from '@sva/plugin-sdk/content-media';
import {
  normalizeStudioMediaPickerSearchValue,
  studioMediaPickerPreviewClassName,
  type StudioMediaPickerAssetSummary,
  type StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';

const StudioMediaPreview = ({ alt, url }: Readonly<{ alt: string; url?: string | null }>) =>
  url ? (
    <img alt={alt} className="h-full w-full object-cover" src={url} />
  ) : (
    <div className="px-4 text-center text-sm text-muted-foreground">{alt}</div>
  );

export type StudioMediaPickerLibraryPanelProps = Readonly<{
  libraryStatus?: Readonly<{
    loading: boolean;
    error: boolean;
    onRetry: () => void | Promise<unknown>;
  }>;
  assets: readonly StudioMediaPickerAssetSummary[];
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  isLoadingReviewAsset?: boolean;
  labels: StudioMediaPickerOverlayLabels['library'];
}>;

const useLibrarySearch = (searchValue: string, tag: string, serverSearch: boolean) => {
  const [remoteAssets, setRemoteAssets] = React.useState<
    readonly StudioMediaPickerAssetSummary[] | null
  >(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!serverSearch) {
      setRemoteAssets(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setFailed(false);
    setRemoteAssets(null);
    const timer = setTimeout(() => {
      void listHostMediaAssets({
        fetch: globalThis.fetch.bind(globalThis),
        search: searchValue.trim(),
        tag: tag.trim(),
        visibility: 'public',
        signal: abort.signal,
      })
        .then((items) => {
          if (abort.signal.aborted) return;
          setRemoteAssets(
            items
              .filter((item) => item.mimeType?.startsWith('image/'))
              .map((item) => ({
                id: item.id,
                title:
                  typeof item.metadata?.title === 'string'
                    ? item.metadata.title
                    : (item.fileName ?? item.id),
                fileName: item.fileName ?? item.id,
                previewUrl: item.previewUrl,
                mimeType: item.mimeType,
                visibility: item.visibility,
              }))
          );
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setFailed(true);
            setRemoteAssets([]);
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [serverSearch, searchValue, tag]);
  return { remoteAssets, loading, failed };
};

const MediaLibraryAsset = ({
  asset,
  labels,
  isAssetSelectable,
  isLoadingReviewAsset,
  onSelectAsset,
}: Pick<
  StudioMediaPickerLibraryPanelProps,
  'labels' | 'isAssetSelectable' | 'isLoadingReviewAsset' | 'onSelectAsset'
> & { asset: StudioMediaPickerAssetSummary }) => {
  const selectable = isAssetSelectable ? isAssetSelectable(asset) : true;
  return (
    <article
      key={asset.id}
      className="space-y-3 rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm"
    >
      <div className={studioMediaPickerPreviewClassName}>
        <StudioMediaPreview alt={asset.title} url={asset.previewUrl} />
      </div>
      <div className="space-y-1">
        <p className="line-clamp-1 text-sm font-semibold text-foreground">{asset.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{asset.fileName}</p>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!selectable || isLoadingReviewAsset}
          onClick={() => void onSelectAsset(asset)}
        >
          {labels.select}
        </Button>
      </div>
    </article>
  );
};

const matchesLibrarySearch = (asset: StudioMediaPickerAssetSummary, query: string) =>
  query.length === 0 ||
  normalizeStudioMediaPickerSearchValue(asset.title).includes(query) ||
  normalizeStudioMediaPickerSearchValue(asset.fileName).includes(query);

const LibraryFeedback = ({
  loading,
  failed,
  labels,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  labels: StudioMediaPickerLibraryPanelProps['labels'];
  onRetry?: () => void | Promise<unknown>;
}) => {
  const t = useContentMediaTranslation();
  return (
    <>
      {loading ? <p role="status">{labels.loading}</p> : null}
      {failed ? (
        <div className="space-y-2">
          <p role="alert">{labels.loadError}</p>
          {onRetry ? (
            <Button type="button" onClick={() => void onRetry()}>
              {t('editor.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export const StudioMediaPickerLibraryPanel = ({
  assets,
  libraryStatus,
  isAssetSelectable,
  isLoadingReviewAsset = false,
  labels,
  onSearchValueChange,
  onSelectAsset,
  searchValue,
}: StudioMediaPickerLibraryPanelProps) => {
  const [tag, setTag] = React.useState('');
  const serverSearch = Boolean(labels.tagLabel && (searchValue.trim() || tag.trim()));
  const {
    remoteAssets,
    loading: searchLoading,
    failed: searchFailed,
  } = useLibrarySearch(searchValue, tag, serverSearch);
  const loading = serverSearch ? searchLoading : libraryStatus?.loading === true;
  const failed = serverSearch ? searchFailed : libraryStatus?.error === true;
  const query = normalizeStudioMediaPickerSearchValue(searchValue);
  const filteredAssets = serverSearch
    ? (remoteAssets ?? [])
    : assets.filter((asset) => matchesLibrarySearch(asset, query));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="studio-media-picker-search">
          {labels.searchLabel}
        </label>
        <Input
          id="studio-media-picker-search"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
        />
      </div>
      {labels.tagLabel ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="studio-media-picker-tag">
            {labels.tagLabel}
          </label>
          <Input
            id="studio-media-picker-tag"
            value={tag}
            maxLength={64}
            onChange={(event) => setTag(event.target.value)}
          />
        </div>
      ) : null}
      <LibraryFeedback
        loading={loading}
        failed={failed}
        labels={labels}
        onRetry={serverSearch ? undefined : libraryStatus?.onRetry}
      />
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <MediaLibraryAsset
              key={asset.id}
              asset={asset}
              labels={labels}
              isAssetSelectable={isAssetSelectable}
              isLoadingReviewAsset={isLoadingReviewAsset}
              onSelectAsset={onSelectAsset}
            />
          ))}
        </div>
      ) : !loading && !failed ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          {labels.empty}
        </div>
      ) : null}
    </div>
  );
};
