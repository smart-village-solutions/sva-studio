import React from 'react';

import { Button } from './button.js';
import { Input } from './input.js';
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
  assets: readonly StudioMediaPickerAssetSummary[];
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectAsset: (asset: StudioMediaPickerAssetSummary) => void | Promise<void>;
  isAssetSelectable?: (asset: StudioMediaPickerAssetSummary) => boolean;
  labels: StudioMediaPickerOverlayLabels['library'];
}>;

export const StudioMediaPickerLibraryPanel = ({
  assets,
  isAssetSelectable,
  labels,
  onSearchValueChange,
  onSelectAsset,
  searchValue,
}: StudioMediaPickerLibraryPanelProps) => {
  const query = normalizeStudioMediaPickerSearchValue(searchValue);
  const filteredAssets = assets.filter((asset) => {
    if (query.length === 0) {
      return true;
    }
    return (
      normalizeStudioMediaPickerSearchValue(asset.title).includes(query) ||
      normalizeStudioMediaPickerSearchValue(asset.fileName).includes(query)
    );
  });

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
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => {
            const selectable = isAssetSelectable ? isAssetSelectable(asset) : true;
            return (
              <article key={asset.id} className="space-y-3 rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                <div className={studioMediaPickerPreviewClassName}>
                  <StudioMediaPreview alt={asset.title} url={asset.previewUrl} />
                </div>
                <div className="space-y-1">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{asset.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{asset.fileName}</p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!selectable} onClick={() => void onSelectAsset(asset)}>
                    {labels.select}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          {labels.empty}
        </div>
      )}
    </div>
  );
};
