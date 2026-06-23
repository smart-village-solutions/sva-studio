import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sva/studio-ui-react';
import React from 'react';
import { useFieldArray, useWatch, useFormContext } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import { normalizePoiMediaAssetId } from './poi.media-asset-id.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

const readAssetTitle = (asset: HostMediaAssetListItem): string => {
  const title = asset.metadata?.title;
  return typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : asset.fileName?.trim() || asset.id;
};

const readAssetFileName = (asset: HostMediaAssetListItem): string => asset.fileName?.trim() || asset.id;

const normalizeSearchValue = (value: string): string => value.trim().toLocaleLowerCase('de-DE');

const matchesAssetSearch = (asset: HostMediaAssetListItem, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  const normalizedTitle = normalizeSearchValue(readAssetTitle(asset));
  const normalizedFileName = normalizeSearchValue(readAssetFileName(asset));
  return normalizedTitle.includes(query) || normalizedFileName.includes(query);
};

const previewPanelClassName =
  'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(148,163,184,0.16))]';

const AssetPreview = ({ asset }: Readonly<{ asset: HostMediaAssetListItem }>) => {
  const previewUrl = asset.previewUrl ?? null;

  if (previewUrl) {
    return <img alt={readAssetTitle(asset)} className="h-full w-full object-cover" loading="lazy" src={previewUrl} />;
  }

  return (
    <div className="space-y-1 px-4 text-center">
      <p className="text-sm font-medium text-foreground">{readAssetTitle(asset)}</p>
      <p className="text-xs text-muted-foreground">{readAssetFileName(asset)}</p>
    </div>
  );
};

export function PoiDetailSettingsImagesCard({
  mediaAssets,
  pt,
}: Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  pt: (key: string) => string;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();
  const { append, remove } = useFieldArray({ control, name: 'media.images' });
  const selectedImages = useWatch({ control, name: 'media.images' }) ?? [];
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const selectedAssetIds = React.useMemo(
    () =>
      new Set(
        selectedImages
          .map((entry) => normalizePoiMediaAssetId(entry.assetId))
          .filter((assetId) => assetId.length > 0)
      ),
    [selectedImages]
  );

  const selectedAssets = React.useMemo(
    () =>
      selectedImages
        .map((entry) => {
          const assetId = normalizePoiMediaAssetId(entry.assetId);
          return mediaAssets.find((asset) => asset.id === assetId) ?? { id: assetId };
        })
        .filter((asset) => asset.id.length > 0)
        .filter((asset, index, collection) => collection.findIndex((entry) => entry.id === asset.id) === index),
    [mediaAssets, selectedImages]
  );

  const availableAssets = React.useMemo(
    () => mediaAssets.filter((asset) => !selectedAssetIds.has(asset.id)),
    [mediaAssets, selectedAssetIds]
  );

  const filteredAssets = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchValue);
    return availableAssets.filter((asset) => matchesAssetSearch(asset, normalizedQuery));
  }, [availableAssets, searchValue]);

  const handleSelectAsset = React.useCallback(
    (assetId: string) => {
      if (selectedAssetIds.has(assetId)) {
        return;
      }

      append({ assetId, label: '' });
      setDialogOpen(false);
      setSearchValue('');
    },
    [append, selectedAssetIds]
  );

  return (
    <PoiDetailSectionCard title={pt('cards.settings.media.title')} description={pt('cards.settings.media.description')}>
      <div className="space-y-5">
        {selectedAssets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedAssets.map((asset) => {
              const selectedIndex = selectedImages.findIndex((entry) => normalizePoiMediaAssetId(entry.assetId) === asset.id);

              return (
                <article key={asset.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
                  <div className={previewPanelClassName}>
                    <AssetPreview asset={asset} />
                  </div>
                  <div className="space-y-1">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">{readAssetTitle(asset)}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{readAssetFileName(asset)}</p>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={() => selectedIndex >= 0 && remove(selectedIndex)}>
                      {pt('actions.removeImage')}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
            {pt('messages.imagePickerEmpty')}
          </div>
        )}

        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            {pt('actions.addImage')}
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSearchValue('');
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{pt('cards.settings.media.title')}</DialogTitle>
            <DialogDescription>{pt('cards.settings.media.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-hidden">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="poi-image-search">
                {pt('fields.imageSearch')}
              </label>
              <Input
                id="poi-image-search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>

            <div className="max-h-[55vh] overflow-y-auto pr-1">
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAssets.map((asset) => (
                    <article key={asset.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
                      <div className={previewPanelClassName}>
                        <AssetPreview asset={asset} />
                      </div>
                      <div className="space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">{readAssetTitle(asset)}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{readAssetFileName(asset)}</p>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" onClick={() => handleSelectAsset(asset.id)}>
                          {pt('actions.selectImage')}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
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
