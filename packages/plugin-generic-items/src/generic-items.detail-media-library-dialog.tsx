import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from '@sva/studio-ui-react';

import {
  getAssetPersistentUrl,
  matchesAssetSearch,
  mediaContentSourceKey,
  normalizeSearchValue,
  readAssetFileName,
  readAssetTitle,
} from './generic-items.detail-media.helpers.js';
import { MediaPreview, previewPanelClassName } from './generic-items.detail-media-preview.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const isSelectableAsset = (asset: HostMediaAssetListItem, selectedUrls: ReadonlySet<string>): boolean => {
  const url = getAssetPersistentUrl(asset);
  return Boolean(url && !selectedUrls.has(url));
};

export function GenericItemsDetailMediaLibraryDialog({
  mediaAssets,
  mediaContents,
  onClose,
  onSelectAsset,
  open,
  labels,
  searchValue,
  setSearchValue,
}: Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  mediaContents: GenericItemsDetailFormValues['mediaContents'];
  onClose: () => void;
  onSelectAsset: (asset: HostMediaAssetListItem) => void;
  open: boolean;
  labels: Record<string, string>;
  searchValue: string;
  setSearchValue: (value: string) => void;
}>) {
  const selectedUrls = new Set(
    mediaContents
      .map((mediaContent) => mediaContentSourceKey({
        sourceUrl: {
          url: mediaContent.sourceUrl.url,
          description: mediaContent.sourceUrl.description,
        },
      }))
      .filter((url) => url.length > 0)
  );
  const query = normalizeSearchValue(searchValue);
  const filteredAssets = mediaAssets.filter((asset) => matchesAssetSearch(asset, query) && isSelectableAsset(asset, selectedUrls));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{labels.mediaContents}</DialogTitle>
          <DialogDescription>{labels.mediaLibraryDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 overflow-hidden">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="generic-item-media-library-search">
              {labels.imageSearch}
            </label>
            <Input id="generic-item-media-library-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
          </div>
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {filteredAssets.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <article key={asset.id} className="space-y-3 rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                    <div className={previewPanelClassName}>
                      <MediaPreview alt={readAssetTitle(asset)} url={getAssetPersistentUrl(asset) ?? ''} />
                    </div>
                    <div className="space-y-1">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">{readAssetTitle(asset)}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{readAssetFileName(asset)}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={() => onSelectAsset(asset)}>
                        {labels.selectImage}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                {labels.imagePickerEmpty}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
