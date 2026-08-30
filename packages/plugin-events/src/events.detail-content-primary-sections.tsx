import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { Button, Checkbox, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import {
  createDefaultAddress,
  createDefaultContact,
  createDefaultDate,
  createDefaultOrganizer,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { EventsDetailCard } from './events.detail-card.js';
import {
  ContentInput,
  indexedId,
  optionalText,
  repeatedItemKey,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';

const firstDateInvalid = (index: number, invalid: boolean) =>
  index === 0 && invalid ? true : undefined;
const firstDateValue = (index: number, input: string, stored?: string) =>
  index === 0 ? input : stored;
const normalizeOrganizer = (organizer: EventsDetailFormValues['content']['organizer']) => {
  const address = organizer.address ?? createDefaultAddress();
  return {
    address,
    contact: organizer.contact ?? createDefaultContact(),
    geoLocation: address.geoLocation ?? { latitude: '', longitude: '' },
  };
};

export function useEventsMapCapabilities() {
  const [geocodingEnabled, setGeocodingEnabled] = useState(true);
  const [reverseGeocodingEnabled, setReverseGeocodingEnabled] = useState(true);
  const [mapEnabled, setMapEnabled] = useState(true);
  const [mapStyleUrl, setMapStyleUrl] = useState('');

  useEffect(() => {
    let active = true;
    void getHostMapGeocodingConfig()
      .then((config) => {
        if (!active) return;
        setGeocodingEnabled(config.geocodeEnabled);
        setReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setGeocodingEnabled(false);
        setReverseGeocodingEnabled(false);
        setMapEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { geocodingEnabled, mapEnabled, mapStyleUrl, reverseGeocodingEnabled };
}

type EventsDateSectionProps = Readonly<{
  dateEndInput: string;
  dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
  dateStartInput: string;
  onDateEndInputChange: (nextValue: string) => void;
  onDateStartInputChange: (nextValue: string) => void;
  pt: Translator;
}>;

export function EventsDateSection({
  dateEndInput,
  dateInputsInvalid,
  dateStartInput,
  onDateEndInputChange,
  onDateStartInputChange,
  pt,
}: EventsDateSectionProps) {
  const { control, setValue } = useFormContext<EventsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'content.dates' });
  const dates = useWatch({ control, name: 'content.dates' }) ?? [];
  const renderedDates = dates.length > 0 ? dates : [createDefaultDate()];
  const changeDateStart = (index: number, value: string) => {
    if (index === 0) return onDateStartInputChange(value);
    setValue(`content.dates.${index}.dateStart`, value, { shouldDirty: true });
  };
  const changeDateEnd = (index: number, value: string) => {
    if (index === 0) return onDateEndInputChange(value);
    setValue(`content.dates.${index}.dateEnd`, value, { shouldDirty: true });
  };

  return (
    <EventsDetailCard
      title={pt('cards.content.dates.title')}
      description={pt('cards.content.dates.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => datesArray.append(createDefaultDate())}
        >
          {pt('actions.addDate')}
        </Button>
      }
    >
      {renderedDates.map((date, index) => (
        <RepeaterItem
          key={repeatedItemKey(datesArray.fields[index]?.id, `fallback-date-${index}`)}
          title={pt('cards.content.dates.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={dates.length > 1 ? () => datesArray.remove(index) : undefined}
        >
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-date-start', index)}
              label={pt('fields.dateStart')}
              type="date"
              ariaInvalid={firstDateInvalid(index, dateInputsInvalid.dateStart)}
              value={firstDateValue(index, dateStartInput, date.dateStart)}
              onChange={(value) => changeDateStart(index, value)}
            />
            <ContentInput
              id={indexedId('event-date-end', index)}
              label={pt('fields.dateEnd')}
              type="date"
              ariaInvalid={firstDateInvalid(index, dateInputsInvalid.dateEnd)}
              value={firstDateValue(index, dateEndInput, date.dateEnd)}
              onChange={(value) => changeDateEnd(index, value)}
            />
          </StudioFieldGroup>
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={indexedId('event-time-start', index)}
              label={pt('fields.timeStart')}
              type="time"
              value={date.timeStart}
              onChange={(value) =>
                setValue(`content.dates.${index}.timeStart`, value, { shouldDirty: true })
              }
            />
            <ContentInput
              id={indexedId('event-time-end', index)}
              label={pt('fields.timeEnd')}
              type="time"
              value={date.timeEnd}
              onChange={(value) =>
                setValue(`content.dates.${index}.timeEnd`, value, { shouldDirty: true })
              }
            />
          </StudioFieldGroup>
          <StudioFieldGroup columns={2}>
            <ContentInput
              id={`event-weekday-${index}`}
              label={pt('fields.weekday')}
              value={date.weekday}
              onChange={(value) =>
                setValue(`content.dates.${index}.weekday`, value, { shouldDirty: true })
              }
            />
            <ContentInput
              id={`event-time-description-${index}`}
              label={pt('fields.timeDescription')}
              value={date.timeDescription}
              onChange={(value) =>
                setValue(`content.dates.${index}.timeDescription`, value, { shouldDirty: true })
              }
            />
          </StudioFieldGroup>
          <StudioField
            id={`event-only-time-description-${index}`}
            label={pt('fields.useOnlyTimeDescription')}
          >
            <Checkbox
              id={`event-only-time-description-${index}`}
              checked={date.useOnlyTimeDescription ?? false}
              onChange={(event) =>
                setValue(`content.dates.${index}.useOnlyTimeDescription`, event.target.checked, {
                  shouldDirty: true,
                })
              }
            />
          </StudioField>
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}

type LocationSectionProps = Readonly<{
  capabilities: ReturnType<typeof useEventsMapCapabilities>;
  pt: Translator;
}>;

export function EventsAddressSection({ capabilities, pt }: LocationSectionProps) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const addressesArray = useFieldArray({ control, name: 'content.addresses' });
  const addresses = useWatch({ control, name: 'content.addresses' }) ?? [];
  const renderedAddresses = addresses.length > 0 ? addresses : [createDefaultAddress()];
  const addressErrors = errors.content?.addresses ?? [];

  return (
    <EventsDetailCard
      title={pt('cards.content.addresses.title')}
      description={pt('cards.content.addresses.description')}
      actions={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => addressesArray.append(createDefaultAddress())}
        >
          {pt('actions.addAddress')}
        </Button>
      }
    >
      {renderedAddresses.map((address, index) => (
        <RepeaterItem
          key={repeatedItemKey(addressesArray.fields[index]?.id, `fallback-address-${index}`)}
          title={pt('cards.content.addresses.itemTitle')}
          removeLabel={pt('actions.remove')}
          onRemove={addresses.length > 1 ? () => addressesArray.remove(index) : undefined}
        >
          <EventsGeoAddressFields
            pt={pt}
            addition={optionalText(address.addition)}
            additionId={indexedId('event-address-name', index)}
            city={optionalText(address.city)}
            cityId={indexedId('event-city', index)}
            geocodingEnabled={capabilities.geocodingEnabled}
            mapEnabled={capabilities.mapEnabled}
            mapStyleUrl={capabilities.mapStyleUrl}
            latitude={optionalText(address.geoLocation?.latitude)}
            latitudeError={
              addressErrors[index]?.geoLocation?.latitude ? pt('validation.geoLocation') : undefined
            }
            latitudeId={indexedId('event-address-latitude', index)}
            longitude={optionalText(address.geoLocation?.longitude)}
            longitudeError={
              addressErrors[index]?.geoLocation?.longitude
                ? pt('validation.geoLocation')
                : undefined
            }
            longitudeId={indexedId('event-address-longitude', index)}
            reverseGeocodingEnabled={capabilities.reverseGeocodingEnabled}
            street={optionalText(address.street)}
            streetId={indexedId('event-street', index)}
            zip={optionalText(address.zip)}
            zipId={indexedId('event-zip', index)}
            onAdditionChange={(value) =>
              setValue(`content.addresses.${index}.addition`, value, { shouldDirty: true })
            }
            onCityChange={(value) =>
              setValue(`content.addresses.${index}.city`, value, { shouldDirty: true })
            }
            onCoordinatesChange={({ latitude, longitude }) => {
              setValue(`content.addresses.${index}.geoLocation.latitude`, latitude, {
                shouldDirty: true,
              });
              setValue(`content.addresses.${index}.geoLocation.longitude`, longitude, {
                shouldDirty: true,
              });
            }}
            onLatitudeChange={(value) =>
              setValue(`content.addresses.${index}.geoLocation.latitude`, value, {
                shouldDirty: true,
              })
            }
            onLongitudeChange={(value) =>
              setValue(`content.addresses.${index}.geoLocation.longitude`, value, {
                shouldDirty: true,
              })
            }
            onStreetChange={(value) =>
              setValue(`content.addresses.${index}.street`, value, { shouldDirty: true })
            }
            onZipChange={(value) =>
              setValue(`content.addresses.${index}.zip`, value, { shouldDirty: true })
            }
          />
        </RepeaterItem>
      ))}
    </EventsDetailCard>
  );
}

export function EventsOrganizerSection({ capabilities, pt }: LocationSectionProps) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const organizer = useWatch({ control, name: 'content.organizer' }) ?? createDefaultOrganizer();
  const { address, contact, geoLocation } = normalizeOrganizer(organizer);
  const organizerErrors = errors.content?.organizer?.address?.geoLocation;

  return (
    <EventsDetailCard
      title={pt('cards.content.organizer.title')}
      description={pt('cards.content.organizer.description')}
    >
      <ContentInput
        id="event-organizer-name"
        label={pt('fields.organizerName')}
        value={organizer.name}
        onChange={(value) => setValue('content.organizer.name', value, { shouldDirty: true })}
      />
      <StudioFieldGroup columns={2}>
        <ContentInput
          id="event-organizer-email"
          label={pt('fields.email')}
          value={contact.email}
          onChange={(value) =>
            setValue(
              'content.organizer.contact',
              { ...(organizer.contact ?? {}), email: value },
              {
                shouldDirty: true,
              }
            )
          }
        />
        <ContentInput
          id="event-organizer-phone"
          label={pt('fields.phone')}
          value={contact.phone}
          onChange={(value) =>
            setValue(
              'content.organizer.contact',
              { ...(organizer.contact ?? {}), phone: value },
              {
                shouldDirty: true,
              }
            )
          }
        />
      </StudioFieldGroup>
      <EventsGeoAddressFields
        pt={pt}
        addition={optionalText(address.addition)}
        additionId="event-organizer-addition"
        city={optionalText(address.city)}
        cityId="event-organizer-city"
        geocodingEnabled={capabilities.geocodingEnabled}
        mapEnabled={capabilities.mapEnabled}
        mapStyleUrl={capabilities.mapStyleUrl}
        latitude={optionalText(geoLocation.latitude)}
        latitudeError={organizerErrors?.latitude ? pt('validation.geoLocation') : undefined}
        latitudeId="event-organizer-latitude"
        longitude={optionalText(geoLocation.longitude)}
        longitudeError={organizerErrors?.longitude ? pt('validation.geoLocation') : undefined}
        longitudeId="event-organizer-longitude"
        reverseGeocodingEnabled={capabilities.reverseGeocodingEnabled}
        street={optionalText(address.street)}
        streetId="event-organizer-street"
        zip={optionalText(address.zip)}
        zipId="event-organizer-zip"
        onAdditionChange={(value) =>
          setValue('content.organizer.address.addition', value, { shouldDirty: true })
        }
        onCityChange={(value) =>
          setValue('content.organizer.address.city', value, { shouldDirty: true })
        }
        onCoordinatesChange={({ latitude, longitude }) => {
          setValue('content.organizer.address.geoLocation.latitude', latitude, {
            shouldDirty: true,
          });
          setValue('content.organizer.address.geoLocation.longitude', longitude, {
            shouldDirty: true,
          });
        }}
        onLatitudeChange={(value) =>
          setValue('content.organizer.address.geoLocation.latitude', value, {
            shouldDirty: true,
          })
        }
        onLongitudeChange={(value) =>
          setValue('content.organizer.address.geoLocation.longitude', value, {
            shouldDirty: true,
          })
        }
        onStreetChange={(value) =>
          setValue('content.organizer.address.street', value, { shouldDirty: true })
        }
        onZipChange={(value) =>
          setValue('content.organizer.address.zip', value, { shouldDirty: true })
        }
      />
    </EventsDetailCard>
  );
}
