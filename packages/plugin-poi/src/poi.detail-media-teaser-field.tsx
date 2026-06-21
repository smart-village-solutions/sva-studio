import { MediaReferenceField } from '@sva/studio-ui-react';
import { Controller, useFormContext } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailMediaTeaserField({
  mediaOptions,
  pt,
}: Readonly<{
  mediaOptions: readonly { assetId: string; label: string }[];
  pt: (key: string) => string;
}>) {
  const { control } = useFormContext<PoiDetailFormValues>();

  return (
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
  );
}
