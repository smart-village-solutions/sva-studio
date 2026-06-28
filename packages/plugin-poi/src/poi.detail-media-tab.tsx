import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import { PoiDetailMediaLibraryDialog } from './poi.detail-media-library-dialog.js';
import { PoiDetailMediaList } from './poi.detail-media-list.js';
import { usePoiDetailMediaState } from './poi.detail-media-state.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

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
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const mediaState = usePoiDetailMediaState({ append, onUploadFile, remove });

  return (
    <PoiDetailSectionCard title={pt('cards.media.entries.title')} description={pt('cards.media.entries.description')}>
      <div className="space-y-5">
        <PoiDetailMediaList errors={errors} fields={fields} mediaContents={mediaContents} onRemove={mediaState.handleRemove} pt={pt} register={register} />

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={mediaState.openDialog}>
            {pt('actions.addImage')}
          </Button>
          <input
            ref={uploadInputRef}
            aria-label={pt('actions.uploadMedia')}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void mediaState.handleUploadChange(event)}
          />
          <Button type="button" variant="outline" disabled={mediaState.uploadBusy} onClick={() => uploadInputRef.current?.click()}>
            {mediaState.uploadBusy ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
          </Button>
          <Button type="button" variant="outline" onClick={mediaState.handleManualAdd}>
            {pt('actions.addMediaManual')}
          </Button>
        </div>
        {mediaState.uploadMessageKey ? (
          <p className={`text-sm font-medium ${mediaState.uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {pt(mediaState.uploadMessageKey)}
          </p>
        ) : null}
      </div>

      <PoiDetailMediaLibraryDialog
        mediaAssets={mediaAssets}
        mediaContents={mediaContents}
        onClose={mediaState.closeDialog}
        onSelectAsset={mediaState.handleSelectAsset}
        open={mediaState.dialogOpen}
        pt={pt}
        searchValue={mediaState.searchValue}
        setSearchValue={mediaState.setSearchValue}
      />
    </PoiDetailSectionCard>
  );
}
