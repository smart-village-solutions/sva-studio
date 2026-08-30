import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button, StudioFieldGroup } from '@sva/studio-ui-react';

import {
  createDefaultContact,
  createDefaultPriceInformation,
  createDefaultUrl,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import {
  ContentInput,
  indexedId,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';

const dirty = { shouldDirty: true } as const;
type SectionProps = Readonly<{ pt: Translator }>;

export function EventsContactSection({ pt }: SectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const array = useFieldArray({ control, name: 'content.contacts' });
  const contacts = useWatch({ control, name: 'content.contacts' }) ?? [];
  const rendered = contacts.length > 0 ? contacts : [createDefaultContact()];
  return (
    <EventsDetailCard
      title={pt('cards.content.contacts.title')}
      description={pt('cards.content.contacts.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => array.append(createDefaultContact())}
        >
          {pt('actions.addContact')}
        </Button>
      }
    >
      {rendered.map((contact, index) => (
        <RepeaterItem
          key={array.fields[index]?.id ?? `fallback-contact-${index}`}
          title={pt('cards.content.contacts.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={contacts.length > 1 ? () => array.remove(index) : undefined}
        >
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-contact-first-name', index)}
              label={pt('fields.firstName')}
              value={contact.firstName}
              onChange={(value) => setValue(`content.contacts.${index}.firstName`, value, dirty)}
            />
            <ContentInput
              id={indexedId('event-contact-last-name', index)}
              label={pt('fields.lastName')}
              value={contact.lastName}
              onChange={(value) => setValue(`content.contacts.${index}.lastName`, value, dirty)}
            />
          </StudioFieldGroup>
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-contact-email', index)}
              label={pt('fields.email')}
              value={contact.email}
              onChange={(value) => setValue(`content.contacts.${index}.email`, value, dirty)}
            />
            <ContentInput
              id={indexedId('event-contact-phone', index)}
              label={pt('fields.phone')}
              value={contact.phone}
              onChange={(value) => setValue(`content.contacts.${index}.phone`, value, dirty)}
            />
          </StudioFieldGroup>
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}

export function EventsLinkSection({ pt }: SectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const array = useFieldArray({ control, name: 'content.urls' });
  const urls = useWatch({ control, name: 'content.urls' }) ?? [];
  const rendered = urls.length > 0 ? urls : [createDefaultUrl()];
  return (
    <EventsDetailCard
      title={pt('cards.content.links.title')}
      description={pt('cards.content.links.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => array.append(createDefaultUrl())}
        >
          {pt('actions.addLink')}
        </Button>
      }
    >
      {rendered.map((url, index) => (
        <RepeaterItem
          key={array.fields[index]?.id ?? `fallback-url-${index}`}
          title={pt('cards.content.links.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={urls.length > 1 ? () => array.remove(index) : undefined}
        >
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-url', index)}
              label={pt('fields.url')}
              value={url.url}
              onChange={(value) => setValue(`content.urls.${index}.url`, value, dirty)}
            />
            <ContentInput
              id={indexedId('event-url-description', index)}
              label={pt('fields.urlDescription')}
              value={url.description}
              onChange={(value) => setValue(`content.urls.${index}.description`, value, dirty)}
            />
          </StudioFieldGroup>
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}

export function EventsPriceSection({ pt }: SectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const array = useFieldArray({ control, name: 'content.priceInformations' });
  const prices = useWatch({ control, name: 'content.priceInformations' }) ?? [];
  const rendered = prices.length > 0 ? prices : [createDefaultPriceInformation()];
  return (
    <EventsDetailCard
      title={pt('cards.content.prices.title')}
      description={pt('cards.content.prices.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => array.append(createDefaultPriceInformation())}
        >
          {pt('actions.addPrice')}
        </Button>
      }
    >
      {rendered.map((price, index) => (
        <RepeaterItem
          key={array.fields[index]?.id ?? `fallback-price-${index}`}
          title={pt('cards.content.prices.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={prices.length > 1 ? () => array.remove(index) : undefined}
        >
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-price-category', index)}
              label={pt('fields.priceCategory')}
              value={price.category}
              onChange={(value) =>
                setValue(`content.priceInformations.${index}.category`, value, dirty)
              }
            />
            <ContentInput
              id={indexedId('event-price-amount', index)}
              label={pt('fields.priceAmount')}
              type="number"
              value={price.amount}
              onChange={(value) =>
                setValue(
                  `content.priceInformations.${index}.amount`,
                  value.trim().length > 0 ? Number(value) : undefined,
                  dirty
                )
              }
            />
          </StudioFieldGroup>
          <ContentInput
            id={indexedId('event-price-description', index)}
            label={pt('fields.priceDescription')}
            value={price.description}
            onChange={(value) =>
              setValue(`content.priceInformations.${index}.description`, value, dirty)
            }
          />
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}
