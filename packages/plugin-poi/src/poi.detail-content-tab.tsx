import type React from 'react';
import { Checkbox, Input, StudioField, StudioFieldGroup, StudioFormSummaryErrors, Textarea, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { useFormContext, useWatch, type FieldError } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';

const SectionCard = ({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: React.ReactNode }>) => (
  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]) =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (error: FieldError | undefined, pt: (key: string) => string): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

const readNestedFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

export function PoiDetailContentTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const description = useWatch({ control, name: 'content.description' }) ?? '';
  const mobileDescription = useWatch({ control, name: 'content.mobileDescription' }) ?? '';
  const addresses = useWatch({ control, name: 'content.addresses' }) ?? [];
  const contact = useWatch({ control, name: 'content.contact' }) ?? {};
  const openingHours = useWatch({ control, name: 'content.openingHours' }) ?? [];
  const webUrls = useWatch({ control, name: 'content.webUrls' }) ?? [];
  const payloadText = useWatch({ control, name: 'content.payloadText' }) ?? '{}';

  const firstAddress = addresses[0] ?? {};
  const firstHour = openingHours[0] ?? {};
  const firstUrl = webUrls[0] ?? { url: '', description: '' };
  const urlField = getStudioFormFieldProps({
    id: 'poi-url',
    error: translateFieldError(readNestedFieldError(errors.content?.webUrls?.[0]?.url), pt),
  });
  const payloadField = getStudioFormFieldProps({
    id: 'poi-payload',
    error: translateFieldError(errors.content?.payloadText, pt),
  });
  const summaryErrors = collectSummaryErrors([urlField, payloadField]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationError')} />
      <SectionCard title={pt('cards.content.descriptions.title')} description={pt('cards.content.descriptions.description')}>
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
      </SectionCard>

      <SectionCard title={pt('cards.content.location.title')} description={pt('cards.content.location.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-street" label={pt('fields.street')}>
            <Input
              id="poi-street"
              value={firstAddress.street ?? ''}
              onChange={(event) =>
                setValue('content.addresses', [{ ...firstAddress, street: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="poi-city" label={pt('fields.city')}>
            <Input
              id="poi-city"
              value={firstAddress.city ?? ''}
              onChange={(event) =>
                setValue('content.addresses', [{ ...firstAddress, city: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.contact.title')} description={pt('cards.content.contact.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-email" label={pt('fields.email')}>
            <Input
              id="poi-email"
              value={contact.email ?? ''}
              onChange={(event) =>
                setValue('content.contact', { ...contact, email: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="poi-phone" label={pt('fields.phone')}>
            <Input
              id="poi-phone"
              value={contact.phone ?? ''}
              onChange={(event) =>
                setValue('content.contact', { ...contact, phone: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.openingHours.title')} description={pt('cards.content.openingHours.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="poi-weekday" label={pt('fields.weekday')}>
            <Input
              id="poi-weekday"
              value={firstHour.weekday ?? ''}
              onChange={(event) =>
                setValue('content.openingHours', [{ ...firstHour, weekday: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="poi-time-from" label={pt('fields.timeFrom')}>
            <Input
              id="poi-time-from"
              value={firstHour.timeFrom ?? ''}
              onChange={(event) =>
                setValue('content.openingHours', [{ ...firstHour, timeFrom: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
        <StudioField id="poi-open" label={pt('fields.open')}>
          <Checkbox
            id="poi-open"
            checked={firstHour.open !== false}
            onChange={(event) =>
              setValue('content.openingHours', [{ ...firstHour, open: event.target.checked }], { shouldDirty: true })
            }
          />
        </StudioField>
      </SectionCard>

      <SectionCard title={pt('cards.content.links.title')} description={pt('cards.content.links.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField {...urlField} label={pt('fields.url')}>
            <Input
              {...urlField.controlProps}
              value={firstUrl.url}
              onChange={(event) =>
                setValue('content.webUrls', [{ ...firstUrl, url: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="poi-url-description" label={pt('fields.urlDescription')}>
            <Input
              id="poi-url-description"
              value={firstUrl.description ?? ''}
              onChange={(event) =>
                setValue('content.webUrls', [{ ...firstUrl, description: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.payload.title')} description={pt('cards.content.payload.description')}>
        <StudioField {...payloadField} label={pt('fields.payload')}>
          <Textarea
            {...payloadField.controlProps}
            rows={8}
            value={payloadText}
            onChange={(event) => setValue('content.payloadText', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </SectionCard>
    </div>
  );
}
