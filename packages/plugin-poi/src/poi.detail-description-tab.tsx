import { StudioField, Textarea } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailDescriptionTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const description = useWatch({ control, name: 'content.description' }) ?? '';
  const mobileDescription = useWatch({ control, name: 'content.mobileDescription' }) ?? '';

  return (
    <PoiDetailSectionCard title={pt('cards.description.text.title')} description={pt('cards.description.text.description')}>
      <StudioField id="poi-description" label={pt('fields.description')}>
        <Textarea
          id="poi-description"
          rows={5}
          value={description}
          onChange={(event) => setValue('content.description', event.target.value, { shouldDirty: true })}
        />
      </StudioField>
      <StudioField id="poi-mobile-description" label={pt('fields.mobileDescription')}>
        <Textarea
          id="poi-mobile-description"
          rows={4}
          value={mobileDescription}
          onChange={(event) => setValue('content.mobileDescription', event.target.value, { shouldDirty: true })}
        />
      </StudioField>
    </PoiDetailSectionCard>
  );
}
