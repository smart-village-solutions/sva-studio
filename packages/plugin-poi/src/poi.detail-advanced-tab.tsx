import { Input, StudioField } from '@sva/studio-ui-react';
import { useFormContext } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailAdvancedTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { register } = useFormContext<PoiDetailFormValues>();

  return (
    <PoiDetailSectionCard
      title={pt('cards.advanced.payload.title')}
      description={pt('cards.advanced.payload.description')}
    >
      <StudioField id="poi-external-id" label={pt('fields.externalId')}>
        <Input id="poi-external-id" {...register('settings.externalId')} />
      </StudioField>
    </PoiDetailSectionCard>
  );
}
