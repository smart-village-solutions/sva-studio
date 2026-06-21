import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailContactTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const contact = useWatch({ control, name: 'content.contact' }) ?? {};

  return (
    <PoiDetailSectionCard title={pt('cards.contact.primary.title')} description={pt('cards.contact.primary.description')}>
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-contact-first-name" label={pt('fields.firstName')}>
          <Input
            id="poi-contact-first-name"
            value={contact.firstName ?? ''}
            onChange={(event) => setValue('content.contact.firstName', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-contact-last-name" label={pt('fields.lastName')}>
          <Input
            id="poi-contact-last-name"
            value={contact.lastName ?? ''}
            onChange={(event) => setValue('content.contact.lastName', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-email" label={pt('fields.email')}>
          <Input
            id="poi-email"
            value={contact.email ?? ''}
            onChange={(event) => setValue('content.contact.email', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-phone" label={pt('fields.phone')}>
          <Input
            id="poi-phone"
            value={contact.phone ?? ''}
            onChange={(event) => setValue('content.contact.phone', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
