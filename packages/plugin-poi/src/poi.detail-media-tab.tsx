import { useFieldArray, useFormContext } from 'react-hook-form';

import { PoiDetailMediaAttachments } from './poi.detail-media-attachments.js';
import { PoiDetailMediaTeaserField } from './poi.detail-media-teaser-field.js';
import { PoiDetailMediaUpload } from './poi.detail-media-upload.js';
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
  const { append, fields, remove } = useFieldArray({ control, name: 'media.attachments' });

  return (
    <PoiDetailSectionCard title={pt('cards.media.references.title')} description={pt('cards.media.references.description')}>
      <PoiDetailMediaUpload
        isUploading={isUploading}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
        onUpload={onUpload}
        onUploaded={(assetId) => append({ assetId, label: '' })}
        pt={pt}
      />
      <PoiDetailMediaTeaserField
        mediaOptions={mediaOptions}
        pt={pt}
      />
      <PoiDetailMediaAttachments
        fields={fields}
        mediaOptions={mediaOptions}
        onAppend={() => append({ assetId: '', label: '' })}
        onRemove={remove}
        pt={pt}
      />
    </PoiDetailSectionCard>
  );
}
