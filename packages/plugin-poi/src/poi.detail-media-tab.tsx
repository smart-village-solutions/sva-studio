import * as React from 'react';
import { Alert, AlertDescription, Button, MediaReferenceField } from '@sva/studio-ui-react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailMediaTab({
  mediaOptions,
  isUploading,
  uploadError,
  uploadSuccess,
  onUpload,
  pt,
}: Readonly<{
  mediaOptions: readonly { assetId: string; label: string }[];
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  onUpload: (file: File) => Promise<string | null>;
  pt: (key: string) => string;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'media.attachments' });
  const uploadInputId = React.useId();
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      const assetId = await onUpload(file);
      if (!assetId) {
        return;
      }
      append({ assetId, label: '' });
    },
    [append, onUpload],
  );

  return (
    <PoiDetailSectionCard title={pt('cards.media.references.title')} description={pt('cards.media.references.description')}>
      <div className="flex flex-wrap gap-3">
        <input
          ref={uploadInputRef}
          id={uploadInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleFileSelection(event)}
        />
        <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
        </Button>
      </div>
      {uploadError ? (
        <Alert>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}
      {uploadSuccess ? (
        <Alert>
          <AlertDescription>{uploadSuccess}</AlertDescription>
        </Alert>
      ) : null}
      <Controller
        name="media.teaserImageAssetId"
        control={control}
        render={({ field }) => (
          <MediaReferenceField
            id="poi-teaser-image"
            label={pt('fields.teaserImage')}
            value={field.value || null}
            options={mediaOptions}
            onChange={(assetId) => field.onChange(assetId ?? '')}
            placeholder={pt('fields.mediaPlaceholder')}
            clearLabel={pt('actions.clearMedia')}
          />
        )}
      />

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-border/60 p-4">
          <Controller
            name={`media.attachments.${index}.assetId`}
            control={control}
            render={({ field: mediaField }) => (
              <MediaReferenceField
                id={`poi-attachment-id-${index}`}
                label={pt('fields.attachmentAsset')}
                value={mediaField.value || null}
                options={mediaOptions}
                onChange={(assetId) => mediaField.onChange(assetId ?? '')}
                placeholder={pt('fields.mediaPlaceholder')}
                clearLabel={pt('actions.clearMedia')}
              />
            )}
          />
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => remove(index)}>
              {pt('actions.remove')}
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => append({ assetId: '', label: '' })}>
        {pt('actions.add')}
      </Button>
    </PoiDetailSectionCard>
  );
}
