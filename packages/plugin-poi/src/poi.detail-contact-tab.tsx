import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

const buildContactWebUrls = (
  currentValue: Readonly<{ url?: string; description?: string }> | undefined,
  nextValue: Readonly<{ url?: string; description?: string }>
) => [
  {
    url: nextValue.url ?? currentValue?.url ?? '',
    description: nextValue.description ?? currentValue?.description ?? '',
  },
];

function ContactUrlFields({
  pt,
  value,
  hasError,
  onChange,
}: Readonly<{
  pt: (key: string) => string;
  value: Readonly<{ url?: string; description?: string }> | undefined;
  hasError: boolean;
  onChange: (nextValue: Readonly<{ url?: string; description?: string }>) => void;
}>) {
  return (
    <>
      <StudioField
        id="poi-contact-url"
        label={pt('fields.url')}
        error={hasError ? pt('validation.webUrls') : undefined}
        errorId="poi-contact-url-error"
      >
        <Input
          id="poi-contact-url"
          aria-describedby={hasError ? 'poi-contact-url-error' : undefined}
          aria-invalid={hasError ? true : undefined}
          value={value?.url ?? ''}
          onChange={(event) => onChange({ url: event.target.value })}
        />
      </StudioField>
      <StudioField id="poi-contact-url-description" label={pt('fields.urlDescription')}>
        <Input
          id="poi-contact-url-description"
          value={value?.description ?? ''}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </StudioField>
    </>
  );
}

export function PoiDetailContactTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    control,
    clearErrors,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const contact = useWatch({ control, name: 'content.contact' }) ?? {};
  const contactWebUrl = contact.webUrls?.[0];
  const contactUrlError = errors.content?.contact?.webUrls?.[0]?.url;

  const updateContactWebUrl = (nextValue: Readonly<{ url?: string; description?: string }>) => {
    clearErrors('content.contact.webUrls.0.url');
    setValue('content.contact.webUrls', buildContactWebUrls(contactWebUrl, nextValue), { shouldDirty: true });
  };

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
        <StudioField id="poi-contact-fax" label={pt('fields.fax')}>
          <Input
            id="poi-contact-fax"
            value={contact.fax ?? ''}
            onChange={(event) => setValue('content.contact.fax', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <ContactUrlFields
          pt={pt}
          value={contactWebUrl}
          hasError={Boolean(contactUrlError)}
          onChange={updateContactWebUrl}
        />
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
