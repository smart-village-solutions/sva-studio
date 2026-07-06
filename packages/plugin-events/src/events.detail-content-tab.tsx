import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button, Checkbox, Input, RichTextHtmlEditor, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import {
  createDefaultAccessibilityInformation,
  createDefaultAddress,
  createDefaultContact,
  createDefaultDate,
  createDefaultOrganizer,
  createDefaultPriceInformation,
  createDefaultUrl,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';
import { getMapGeocodingConfig } from './events.map-geocoding-client.js';
type Translator = (key: string) => string;

const EventCardSection = ({
  title,
  description,
  actions,
  children,
}: Readonly<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}>) => (
  <EventsDetailCard title={title} description={description} actions={actions}>
    {children}
  </EventsDetailCard>
);

export function EventsDetailContentTab({
  dateEndInput,
  dateInputsInvalid,
  dateStartInput,
  onDateEndInputChange,
  onDateStartInputChange,
  pt,
}: Readonly<{
  dateEndInput: string;
  dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
  dateStartInput: string;
  onDateEndInputChange: (nextValue: string) => void;
  onDateStartInputChange: (nextValue: string) => void;
  pt: Translator;
}>) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'content.dates' });
  const addressesArray = useFieldArray({ control, name: 'content.addresses' });
  const contactsArray = useFieldArray({ control, name: 'content.contacts' });
  const urlsArray = useFieldArray({ control, name: 'content.urls' });
  const pricesArray = useFieldArray({ control, name: 'content.priceInformations' });

  const description = useWatch({ control, name: 'content.description' }) ?? '';
  const dates = useWatch({ control, name: 'content.dates' }) ?? [];
  const addresses = useWatch({ control, name: 'content.addresses' }) ?? [];
  const contacts = useWatch({ control, name: 'content.contacts' }) ?? [];
  const urls = useWatch({ control, name: 'content.urls' }) ?? [];
  const organizer = useWatch({ control, name: 'content.organizer' }) ?? createDefaultOrganizer();
  const prices = useWatch({ control, name: 'content.priceInformations' }) ?? [];
  const accessibility = useWatch({ control, name: 'content.accessibilityInformation' }) ?? createDefaultAccessibilityInformation();
  const renderedDates = dates.length > 0 ? dates : [createDefaultDate()];
  const renderedAddresses = addresses.length > 0 ? addresses : [createDefaultAddress()];
  const renderedContacts = contacts.length > 0 ? contacts : [createDefaultContact()];
  const renderedUrls = urls.length > 0 ? urls : [createDefaultUrl()];
  const renderedPrices = prices.length > 0 ? prices : [createDefaultPriceInformation()];
  const descriptionLabelId = 'event-description-label';
  const addressGeoLocationErrors = errors.content?.addresses ?? [];
  const organizerGeoLocationErrors = errors.content?.organizer?.address?.geoLocation;
  const [isGeocodingEnabled, setIsGeocodingEnabled] = useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = useState(true);
  const [isMapEnabled, setIsMapEnabled] = useState(true);
  const [mapStyleUrl, setMapStyleUrl] = useState('');
  const blockTypeOptions = [
    { value: 'paragraph' as const, label: pt('richText.paragraph') },
    { value: 'heading-2' as const, label: pt('richText.heading2') },
    { value: 'heading-3' as const, label: pt('richText.heading3') },
    { value: 'heading-4' as const, label: pt('richText.heading4') },
    { value: 'blockquote' as const, label: pt('richText.blockquote') },
  ];

  useEffect(() => {
    let active = true;
    void getMapGeocodingConfig()
      .then((config) => {
        if (!active) {
          return;
        }
        setIsGeocodingEnabled(config.geocodeEnabled);
        setIsReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setIsMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setIsGeocodingEnabled(false);
        setIsReverseGeocodingEnabled(false);
        setIsMapEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <EventCardSection title={pt('cards.content.descriptions.title')} description={pt('cards.content.descriptions.description')}>
        <div className="space-y-1">
          <label id={descriptionLabelId} htmlFor="event-description" className="text-sm font-medium">
            {pt('fields.description')}
          </label>
          <RichTextHtmlEditor
            id="event-description"
            labelId={descriptionLabelId}
            value={description}
            onChange={(nextValue) => setValue('content.description', nextValue, { shouldDirty: true })}
            blockTypeOptions={blockTypeOptions}
            toolbarLabels={{
              blockType: pt('richText.blockType'),
              bulletList: pt('richText.bulletList'),
              orderedList: pt('richText.orderedList'),
              bold: pt('richText.bold'),
              italic: pt('richText.italic'),
              undo: pt('richText.undo'),
              redo: pt('richText.redo'),
              link: pt('richText.applyLink'),
              linkPrompt: pt('richText.linkInput'),
            }}
          />
        </div>
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.dates.title')}
        description={pt('cards.content.dates.description')}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => datesArray.append(createDefaultDate())}>
            {pt('actions.addDate')}
          </Button>
        }
      >
        {renderedDates.map((date, index) => (
          <div
            key={datesArray.fields[index]?.id ?? `fallback-date-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pt('cards.content.dates.itemTitle')}</p>
              {dates.length > 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => datesArray.remove(index)}>
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <StudioFieldGroup columns={2}>
              <StudioField id={index === 0 ? 'event-date-start' : `event-date-start-${index}`} label={pt('fields.dateStart')}>
                <Input
                  id={index === 0 ? 'event-date-start' : `event-date-start-${index}`}
                  type="date"
                  aria-invalid={index === 0 && dateInputsInvalid.dateStart ? true : undefined}
                  value={index === 0 ? dateStartInput : date.dateStart ?? ''}
                  onChange={(event) => {
                    if (index === 0) {
                      onDateStartInputChange(event.target.value);
                      return;
                    }
                    setValue(`content.dates.${index}.dateStart`, event.target.value, { shouldDirty: true });
                  }}
                />
              </StudioField>
              <StudioField id={index === 0 ? 'event-date-end' : `event-date-end-${index}`} label={pt('fields.dateEnd')}>
                <Input
                  id={index === 0 ? 'event-date-end' : `event-date-end-${index}`}
                  type="date"
                  aria-invalid={index === 0 && dateInputsInvalid.dateEnd ? true : undefined}
                  value={index === 0 ? dateEndInput : date.dateEnd ?? ''}
                  onChange={(event) => {
                    if (index === 0) {
                      onDateEndInputChange(event.target.value);
                      return;
                    }
                    setValue(`content.dates.${index}.dateEnd`, event.target.value, { shouldDirty: true });
                  }}
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <StudioField id={index === 0 ? 'event-time-start' : `event-time-start-${index}`} label={pt('fields.timeStart')}>
                <Input
                  id={index === 0 ? 'event-time-start' : `event-time-start-${index}`}
                  value={date.timeStart ?? ''}
                  onChange={(event) => setValue(`content.dates.${index}.timeStart`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id={index === 0 ? 'event-time-end' : `event-time-end-${index}`} label={pt('fields.timeEnd')}>
                <Input
                  id={index === 0 ? 'event-time-end' : `event-time-end-${index}`}
                  value={date.timeEnd ?? ''}
                  onChange={(event) => setValue(`content.dates.${index}.timeEnd`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <StudioField id={`event-weekday-${index}`} label={pt('fields.weekday')}>
                <Input
                  id={`event-weekday-${index}`}
                  value={date.weekday ?? ''}
                  onChange={(event) => setValue(`content.dates.${index}.weekday`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id={`event-time-description-${index}`} label={pt('fields.timeDescription')}>
                <Input
                  id={`event-time-description-${index}`}
                  value={date.timeDescription ?? ''}
                  onChange={(event) =>
                    setValue(`content.dates.${index}.timeDescription`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioField id={`event-only-time-description-${index}`} label={pt('fields.useOnlyTimeDescription')}>
              <Checkbox
                id={`event-only-time-description-${index}`}
                checked={date.useOnlyTimeDescription ?? false}
                onChange={(event) =>
                  setValue(`content.dates.${index}.useOnlyTimeDescription`, event.target.checked, { shouldDirty: true })
                }
              />
            </StudioField>
          </div>
        ))}
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.addresses.title')}
        description={pt('cards.content.addresses.description')}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => addressesArray.append(createDefaultAddress())}>
            {pt('actions.addAddress')}
          </Button>
        }
      >
        {renderedAddresses.map((address, index) => (
          <div
            key={addressesArray.fields[index]?.id ?? `fallback-address-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pt('cards.content.addresses.itemTitle')}</p>
              {addresses.length > 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => addressesArray.remove(index)}>
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <EventsGeoAddressFields
              pt={pt}
              addition={address.addition ?? ''}
              additionId={index === 0 ? 'event-address-name' : `event-address-name-${index}`}
              city={address.city ?? ''}
              cityId={index === 0 ? 'event-city' : `event-city-${index}`}
              geocodingEnabled={isGeocodingEnabled}
              mapEnabled={isMapEnabled}
              mapStyleUrl={mapStyleUrl}
              latitude={address.geoLocation?.latitude ?? ''}
              latitudeError={addressGeoLocationErrors[index]?.geoLocation?.latitude ? pt('validation.geoLocation') : undefined}
              latitudeId={index === 0 ? 'event-address-latitude' : `event-address-latitude-${index}`}
              longitude={address.geoLocation?.longitude ?? ''}
              longitudeError={addressGeoLocationErrors[index]?.geoLocation?.longitude ? pt('validation.geoLocation') : undefined}
              longitudeId={index === 0 ? 'event-address-longitude' : `event-address-longitude-${index}`}
              reverseGeocodingEnabled={isReverseGeocodingEnabled}
              street={address.street ?? ''}
              streetId={index === 0 ? 'event-street' : `event-street-${index}`}
              zip={address.zip ?? ''}
              zipId={index === 0 ? 'event-zip' : `event-zip-${index}`}
              onAdditionChange={(value) => setValue(`content.addresses.${index}.addition`, value, { shouldDirty: true })}
              onCityChange={(value) => setValue(`content.addresses.${index}.city`, value, { shouldDirty: true })}
              onCoordinatesChange={(coordinates) => {
                setValue(`content.addresses.${index}.geoLocation.latitude`, coordinates.latitude, { shouldDirty: true });
                setValue(`content.addresses.${index}.geoLocation.longitude`, coordinates.longitude, { shouldDirty: true });
              }}
              onLatitudeChange={(value) => setValue(`content.addresses.${index}.geoLocation.latitude`, value, { shouldDirty: true })}
              onLongitudeChange={(value) => setValue(`content.addresses.${index}.geoLocation.longitude`, value, { shouldDirty: true })}
              onStreetChange={(value) => setValue(`content.addresses.${index}.street`, value, { shouldDirty: true })}
              onZipChange={(value) => setValue(`content.addresses.${index}.zip`, value, { shouldDirty: true })}
            />
          </div>
        ))}
      </EventCardSection>

      <EventCardSection title={pt('cards.content.organizer.title')} description={pt('cards.content.organizer.description')}>
        <StudioField id="event-organizer-name" label={pt('fields.organizerName')}>
          <Input
            id="event-organizer-name"
            value={organizer.name ?? ''}
            onChange={(event) => setValue('content.organizer.name', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-organizer-email" label={pt('fields.email')}>
            <Input
              id="event-organizer-email"
              value={organizer.contact?.email ?? ''}
              onChange={(event) =>
                setValue('content.organizer.contact', { ...(organizer.contact ?? {}), email: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
          <StudioField id="event-organizer-phone" label={pt('fields.phone')}>
            <Input
              id="event-organizer-phone"
              value={organizer.contact?.phone ?? ''}
              onChange={(event) =>
                setValue('content.organizer.contact', { ...(organizer.contact ?? {}), phone: event.target.value }, { shouldDirty: true })
              }
            />
          </StudioField>
        </StudioFieldGroup>
        <EventsGeoAddressFields
          pt={pt}
          addition={organizer.address?.addition ?? ''}
          additionId="event-organizer-addition"
          city={organizer.address?.city ?? ''}
          cityId="event-organizer-city"
          geocodingEnabled={isGeocodingEnabled}
          mapEnabled={isMapEnabled}
          mapStyleUrl={mapStyleUrl}
          latitude={organizer.address?.geoLocation?.latitude ?? ''}
          latitudeError={organizerGeoLocationErrors?.latitude ? pt('validation.geoLocation') : undefined}
          latitudeId="event-organizer-latitude"
          longitude={organizer.address?.geoLocation?.longitude ?? ''}
          longitudeError={organizerGeoLocationErrors?.longitude ? pt('validation.geoLocation') : undefined}
          longitudeId="event-organizer-longitude"
          reverseGeocodingEnabled={isReverseGeocodingEnabled}
          street={organizer.address?.street ?? ''}
          streetId="event-organizer-street"
          zip={organizer.address?.zip ?? ''}
          zipId="event-organizer-zip"
          onAdditionChange={(value) => setValue('content.organizer.address.addition', value, { shouldDirty: true })}
          onCityChange={(value) => setValue('content.organizer.address.city', value, { shouldDirty: true })}
          onCoordinatesChange={(coordinates) => {
            setValue('content.organizer.address.geoLocation.latitude', coordinates.latitude, { shouldDirty: true });
            setValue('content.organizer.address.geoLocation.longitude', coordinates.longitude, { shouldDirty: true });
          }}
          onLatitudeChange={(value) => setValue('content.organizer.address.geoLocation.latitude', value, { shouldDirty: true })}
          onLongitudeChange={(value) => setValue('content.organizer.address.geoLocation.longitude', value, { shouldDirty: true })}
          onStreetChange={(value) => setValue('content.organizer.address.street', value, { shouldDirty: true })}
          onZipChange={(value) => setValue('content.organizer.address.zip', value, { shouldDirty: true })}
        />
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.contacts.title')}
        description={pt('cards.content.contacts.description')}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => contactsArray.append(createDefaultContact())}>
            {pt('actions.addContact')}
          </Button>
        }
      >
        {renderedContacts.map((contact, index) => (
          <div
            key={contactsArray.fields[index]?.id ?? `fallback-contact-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pt('cards.content.contacts.itemTitle')}</p>
              {contacts.length > 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => contactsArray.remove(index)}>
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <StudioFieldGroup columns={2}>
              <StudioField
                id={index === 0 ? 'event-contact-first-name' : `event-contact-first-name-${index}`}
                label={pt('fields.firstName')}
              >
                <Input
                  id={index === 0 ? 'event-contact-first-name' : `event-contact-first-name-${index}`}
                  value={contact.firstName ?? ''}
                  onChange={(event) => setValue(`content.contacts.${index}.firstName`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField
                id={index === 0 ? 'event-contact-last-name' : `event-contact-last-name-${index}`}
                label={pt('fields.lastName')}
              >
                <Input
                  id={index === 0 ? 'event-contact-last-name' : `event-contact-last-name-${index}`}
                  value={contact.lastName ?? ''}
                  onChange={(event) => setValue(`content.contacts.${index}.lastName`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <StudioField id={index === 0 ? 'event-contact-email' : `event-contact-email-${index}`} label={pt('fields.email')}>
                <Input
                  id={index === 0 ? 'event-contact-email' : `event-contact-email-${index}`}
                  value={contact.email ?? ''}
                  onChange={(event) => setValue(`content.contacts.${index}.email`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id={index === 0 ? 'event-contact-phone' : `event-contact-phone-${index}`} label={pt('fields.phone')}>
                <Input
                  id={index === 0 ? 'event-contact-phone' : `event-contact-phone-${index}`}
                  value={contact.phone ?? ''}
                  onChange={(event) => setValue(`content.contacts.${index}.phone`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
            </StudioFieldGroup>
          </div>
        ))}
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.links.title')}
        description={pt('cards.content.links.description')}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => urlsArray.append(createDefaultUrl())}>
            {pt('actions.addLink')}
          </Button>
        }
      >
        {renderedUrls.map((url, index) => (
          <div key={urlsArray.fields[index]?.id ?? `fallback-url-${index}`} className="space-y-4 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pt('cards.content.links.itemTitle')}</p>
              {urls.length > 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => urlsArray.remove(index)}>
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <StudioFieldGroup columns={2}>
              <StudioField id={index === 0 ? 'event-url' : `event-url-${index}`} label={pt('fields.url')}>
                <Input
                  id={index === 0 ? 'event-url' : `event-url-${index}`}
                  value={url.url}
                  onChange={(event) => setValue(`content.urls.${index}.url`, event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField
                id={index === 0 ? 'event-url-description' : `event-url-description-${index}`}
                label={pt('fields.urlDescription')}
              >
                <Input
                  id={index === 0 ? 'event-url-description' : `event-url-description-${index}`}
                  value={url.description ?? ''}
                  onChange={(event) =>
                    setValue(`content.urls.${index}.description`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
            </StudioFieldGroup>
          </div>
        ))}
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.prices.title')}
        description={pt('cards.content.prices.description')}
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => pricesArray.append(createDefaultPriceInformation())}>
            {pt('actions.addPrice')}
          </Button>
        }
      >
        {renderedPrices.map((price, index) => (
          <div
            key={pricesArray.fields[index]?.id ?? `fallback-price-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{pt('cards.content.prices.itemTitle')}</p>
              {prices.length > 1 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => pricesArray.remove(index)}>
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <StudioFieldGroup columns={2}>
              <StudioField
                id={index === 0 ? 'event-price-category' : `event-price-category-${index}`}
                label={pt('fields.priceCategory')}
              >
                <Input
                  id={index === 0 ? 'event-price-category' : `event-price-category-${index}`}
                  value={price.category ?? ''}
                  onChange={(event) =>
                    setValue(`content.priceInformations.${index}.category`, event.target.value, { shouldDirty: true })
                  }
                />
              </StudioField>
              <StudioField id={index === 0 ? 'event-price-amount' : `event-price-amount-${index}`} label={pt('fields.priceAmount')}>
                <Input
                  id={index === 0 ? 'event-price-amount' : `event-price-amount-${index}`}
                  type="number"
                  value={price.amount ?? ''}
                  onChange={(event) =>
                    setValue(
                      `content.priceInformations.${index}.amount`,
                      event.target.value.trim().length > 0 ? Number(event.target.value) : undefined,
                      { shouldDirty: true }
                    )
                  }
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioField
              id={index === 0 ? 'event-price-description' : `event-price-description-${index}`}
              label={pt('fields.priceDescription')}
            >
              <Input
                id={index === 0 ? 'event-price-description' : `event-price-description-${index}`}
                value={price.description ?? ''}
                onChange={(event) =>
                  setValue(`content.priceInformations.${index}.description`, event.target.value, { shouldDirty: true })
                }
              />
            </StudioField>
          </div>
        ))}
      </EventCardSection>

      <EventCardSection
        title={pt('cards.content.accessibility.title')}
        description={pt('cards.content.accessibility.description')}
      >
        <StudioField id="event-accessibility-description" label={pt('fields.accessibilityDescription')}>
          <Textarea
            id="event-accessibility-description"
            rows={3}
            value={accessibility.description ?? ''}
            onChange={(event) =>
              setValue('content.accessibilityInformation.description', event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
        <StudioField id="event-accessibility-types" label={pt('fields.accessibilityTypes')}>
          <Input
            id="event-accessibility-types"
            value={accessibility.types ?? ''}
            onChange={(event) => setValue('content.accessibilityInformation.types', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </EventCardSection>
    </div>
  );
}
