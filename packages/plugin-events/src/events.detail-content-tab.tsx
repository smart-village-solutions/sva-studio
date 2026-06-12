import type React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import type { PoiSelectItem } from './events.types.js';

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

export function EventsDetailContentTab({
  dateEndInput,
  dateInputsInvalid,
  dateStartInput,
  onDateEndInputChange,
  onDateStartInputChange,
  pois,
  pt,
}: Readonly<{
  dateEndInput: string;
  dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
  dateStartInput: string;
  onDateEndInputChange: (nextValue: string) => void;
  onDateStartInputChange: (nextValue: string) => void;
  pois: readonly PoiSelectItem[];
  pt: (key: string) => string;
}>) {
  const { register, setValue } = useFormContext<EventsDetailFormValues>();
  const dates = useWatch({ name: 'content.dates' }) ?? [];
  const addresses = useWatch({ name: 'content.addresses' }) ?? [];
  const contact = useWatch({ name: 'content.contact' }) ?? {};
  const urls = useWatch({ name: 'content.urls' }) ?? [];
  const repeat = useWatch({ name: 'content.repeat' }) ?? false;
  const pointOfInterestId = useWatch({ name: 'content.pointOfInterestId' }) ?? '';

  const firstDate = dates[0] ?? {};
  const firstAddress = addresses[0] ?? {};
  const firstUrl = urls[0] ?? { url: '', description: '' };

  return (
    <div className="space-y-6">
      <SectionCard title={pt('cards.content.descriptions.title')} description={pt('cards.content.descriptions.description')}>
        <StudioField id="event-description" label={pt('fields.description')}>
          <Textarea id="event-description" rows={6} {...register('content.description')} />
        </StudioField>
      </SectionCard>

      <SectionCard title={pt('cards.content.dates.title')} description={pt('cards.content.dates.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-date-start" label={pt('fields.dateStart')}>
            <Input
              id="event-date-start"
              type="datetime-local"
              aria-invalid={dateInputsInvalid.dateStart || undefined}
              value={dateStartInput}
              onChange={(event) => onDateStartInputChange(event.target.value)}
            />
          </StudioField>
          <StudioField id="event-date-end" label={pt('fields.dateEnd')}>
            <Input
              id="event-date-end"
              type="datetime-local"
              aria-invalid={dateInputsInvalid.dateEnd || undefined}
              value={dateEndInput}
              onChange={(event) => onDateEndInputChange(event.target.value)}
            />
          </StudioField>
        </StudioFieldGroup>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-time-start" label={pt('fields.timeStart')}>
            <Input
              id="event-time-start"
              value={firstDate.timeStart ?? ''}
              onChange={(event) =>
                setValue('content.dates', [{ ...firstDate, timeStart: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="event-time-end" label={pt('fields.timeEnd')}>
            <Input
              id="event-time-end"
              value={firstDate.timeEnd ?? ''}
              onChange={(event) =>
                setValue('content.dates', [{ ...firstDate, timeEnd: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.addresses.title')} description={pt('cards.content.addresses.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-street" label={pt('fields.street')}>
            <Input
              id="event-street"
              value={firstAddress.street ?? ''}
              onChange={(event) =>
                setValue('content.addresses', [{ ...firstAddress, street: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="event-city" label={pt('fields.city')}>
            <Input
              id="event-city"
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
          <StudioField id="event-email" label={pt('fields.email')}>
            <Input
              id="event-email"
              value={contact.email ?? ''}
              onChange={(event) =>
                setValue('content.contact', { ...contact, email: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="event-phone" label={pt('fields.phone')}>
            <Input
              id="event-phone"
              value={contact.phone ?? ''}
              onChange={(event) =>
                setValue('content.contact', { ...contact, phone: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.links.title')} description={pt('cards.content.links.description')}>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-url" label={pt('fields.url')}>
            <Input
              id="event-url"
              value={firstUrl.url}
              onChange={(event) =>
                setValue('content.urls', [{ ...firstUrl, url: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="event-url-description" label={pt('fields.urlDescription')}>
            <Input
              id="event-url-description"
              value={firstUrl.description ?? ''}
              onChange={(event) =>
                setValue('content.urls', [{ ...firstUrl, description: event.target.value }], { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
      </SectionCard>

      <SectionCard title={pt('cards.content.recurrence.title')} description={pt('cards.content.recurrence.description')}>
        <StudioField id="event-repeat" label={pt('fields.repeat')}>
          <Checkbox
            id="event-repeat"
            checked={repeat}
            onChange={(event) => setValue('content.repeat', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
      </SectionCard>

      <SectionCard title={pt('cards.content.poi.title')} description={pt('cards.content.poi.description')}>
        <StudioField id="event-poi" label={pt('fields.pointOfInterestId')}>
          <Select
            id="event-poi"
            value={pointOfInterestId}
            onChange={(event) => setValue('content.pointOfInterestId', event.target.value, { shouldDirty: true })}
          >
            <option value="">—</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.name}
              </option>
            ))}
          </Select>
        </StudioField>
      </SectionCard>
    </div>
  );
}
