import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import { createDefaultMediaContent } from './poi.detail-form.defaults.js';
import { PoiDetailMediaList } from './poi.detail-media-list.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';

export function PoiDetailMediaTab({
  onOpenMediaPicker,
  pt,
}: Readonly<{
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  pt: (key: string) => string;
}>) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<PoiDetailFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'content.mediaContents' });
  const mediaContents = useWatch({ control, name: 'content.mediaContents' }) ?? [];

  return (
    <PoiDetailSectionCard title={pt('cards.media.entries.title')} description={pt('cards.media.entries.description')}>
      <div className="space-y-5">
        <PoiDetailMediaList errors={errors} fields={fields} mediaContents={mediaContents} onRemove={remove} pt={pt} register={register} />

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenMediaPicker('library')}>
            {pt('actions.addImage')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenMediaPicker('upload')}>
            {pt('actions.uploadMedia')}
          </Button>
          <Button type="button" variant="outline" onClick={() => append(createDefaultMediaContent())}>
            {pt('actions.addMediaManual')}
          </Button>
        </div>
      </div>
    </PoiDetailSectionCard>
  );
}
