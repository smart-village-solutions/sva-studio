import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailOperatorTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const operator = useWatch({ control, name: 'content.operator' }) ?? {};

  return (
    <PoiDetailSectionCard title={pt('cards.operator.details.title')} description={pt('cards.operator.details.description')}>
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-operator-name" label={pt('fields.operatorName')}>
          <Input
            id="poi-operator-name"
            value={operator.name ?? ''}
            onChange={(event) => setValue('content.operator.name', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-email" label={pt('fields.email')}>
          <Input
            id="poi-operator-email"
            value={operator.contact?.email ?? ''}
            onChange={(event) => setValue('content.operator.contact.email', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
