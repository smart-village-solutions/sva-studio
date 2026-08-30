import { useEffect, useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { getHostMapGeocodingConfig } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import {
  createDefaultAddress,
  createDefaultDate,
  createDefaultOrganizer,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import {
  EventsContactLinkSections,
  EventsDescriptionMediaSections,
  EventsPriceSection,
} from './events.detail-content-secondary-sections.js';
import { EventsDetailCard } from './events.detail-card.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';

export function EventsDetailContentTab({
  dateEndInput,
  dateInputsInvalid,
  dateStartInput,
  onAddManualMedia,
  onOpenMediaPicker,
  mediaUsages,
  onChangeMediaUsages,
  canSelectMedia,
  canUploadMedia,
  mediaEditingDisabled,
  onLoadAssetSnapshot,
  onDateEndInputChange,
  onDateStartInputChange,
  pt,
}: React.ComponentProps<typeof EventsDescriptionMediaSections> &
  Readonly<{
    dateEndInput: string;
    dateInputsInvalid: Readonly<{ dateStart: boolean; dateEnd: boolean }>;
    dateStartInput: string;
    onDateEndInputChange: (nextValue: string) => void;
    onDateStartInputChange: (nextValue: string) => void;
  }>) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const datesArray = useFieldArray({ control, name: 'content.dates' });
  const addressesArray = useFieldArray({ control, name: 'content.addresses' });
  const dates = useWatch({ control, name: 'content.dates' }) ?? [];
  const addresses = useWatch({ control, name: 'content.addresses' }) ?? [];
  const organizer = useWatch({ control, name: 'content.organizer' }) ?? createDefaultOrganizer();
  const renderedDates = dates.length > 0 ? dates : [createDefaultDate()];
  const renderedAddresses = addresses.length > 0 ? addresses : [createDefaultAddress()];
  const addressGeoLocationErrors = errors.content?.addresses ?? [];
  const organizerGeoLocationErrors = errors.content?.organizer?.address?.geoLocation;
  const [isGeocodingEnabled, setIsGeocodingEnabled] = useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = useState(true);
  const [isMapEnabled, setIsMapEnabled] = useState(true);
  const [mapStyleUrl, setMapStyleUrl] = useState('');

  useEffect(() => {
    let active = true;
    void getHostMapGeocodingConfig()
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
      <EventsDescriptionMediaSections
        onAddManualMedia={onAddManualMedia}
        onOpenMediaPicker={onOpenMediaPicker}
        mediaUsages={mediaUsages}
        onChangeMediaUsages={onChangeMediaUsages}
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        mediaEditingDisabled={mediaEditingDisabled}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        pt={pt}
      />

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
          <div
            key={datesArray.fields[index]?.id ?? `fallback-date-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {pt('cards.content.dates.itemTitle')}
              </p>
              {dates.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => datesArray.remove(index)}
                >
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </div>
            <StudioFieldGroup columns={2}>
              <StudioField
                id={index === 0 ? 'event-date-start' : `event-date-start-${index}`}
                label={pt('fields.dateStart')}
              >
                <Input
                  id={index === 0 ? 'event-date-start' : `event-date-start-${index}`}
                  type="date"
                  aria-invalid={index === 0 && dateInputsInvalid.dateStart ? true : undefined}
                  value={index === 0 ? dateStartInput : (date.dateStart ?? '')}
                  onChange={(event) => {
                    if (index === 0) {
                      onDateStartInputChange(event.target.value);
                      return;
                    }
                    setValue(`content.dates.${index}.dateStart`, event.target.value, {
                      shouldDirty: true,
                    });
                  }}
                />
              </StudioField>
              <StudioField
                id={index === 0 ? 'event-date-end' : `event-date-end-${index}`}
                label={pt('fields.dateEnd')}
              >
                <Input
                  id={index === 0 ? 'event-date-end' : `event-date-end-${index}`}
                  type="date"
                  aria-invalid={index === 0 && dateInputsInvalid.dateEnd ? true : undefined}
                  value={index === 0 ? dateEndInput : (date.dateEnd ?? '')}
                  onChange={(event) => {
                    if (index === 0) {
                      onDateEndInputChange(event.target.value);
                      return;
                    }
                    setValue(`content.dates.${index}.dateEnd`, event.target.value, {
                      shouldDirty: true,
                    });
                  }}
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <StudioField
                id={index === 0 ? 'event-time-start' : `event-time-start-${index}`}
                label={pt('fields.timeStart')}
              >
                <Input
                  id={index === 0 ? 'event-time-start' : `event-time-start-${index}`}
                  type="time"
                  value={date.timeStart ?? ''}
                  onChange={(event) =>
                    setValue(`content.dates.${index}.timeStart`, event.target.value, {
                      shouldDirty: true,
                    })
                  }
                />
              </StudioField>
              <StudioField
                id={index === 0 ? 'event-time-end' : `event-time-end-${index}`}
                label={pt('fields.timeEnd')}
              >
                <Input
                  id={index === 0 ? 'event-time-end' : `event-time-end-${index}`}
                  type="time"
                  value={date.timeEnd ?? ''}
                  onChange={(event) =>
                    setValue(`content.dates.${index}.timeEnd`, event.target.value, {
                      shouldDirty: true,
                    })
                  }
                />
              </StudioField>
            </StudioFieldGroup>
            <StudioFieldGroup columns={2}>
              <StudioField id={`event-weekday-${index}`} label={pt('fields.weekday')}>
                <Input
                  id={`event-weekday-${index}`}
                  value={date.weekday ?? ''}
                  onChange={(event) =>
                    setValue(`content.dates.${index}.weekday`, event.target.value, {
                      shouldDirty: true,
                    })
                  }
                />
              </StudioField>
              <StudioField
                id={`event-time-description-${index}`}
                label={pt('fields.timeDescription')}
              >
                <Input
                  id={`event-time-description-${index}`}
                  value={date.timeDescription ?? ''}
                  onChange={(event) =>
                    setValue(`content.dates.${index}.timeDescription`, event.target.value, {
                      shouldDirty: true,
                    })
                  }
                />
              </StudioField>
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
          </div>
        ))}
      </EventsDetailCard>

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
          <div
            key={addressesArray.fields[index]?.id ?? `fallback-address-${index}`}
            className="space-y-4 rounded-xl border border-border/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {pt('cards.content.addresses.itemTitle')}
              </p>
              {addresses.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addressesArray.remove(index)}
                >
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
              latitudeError={
                addressGeoLocationErrors[index]?.geoLocation?.latitude
                  ? pt('validation.geoLocation')
                  : undefined
              }
              latitudeId={
                index === 0 ? 'event-address-latitude' : `event-address-latitude-${index}`
              }
              longitude={address.geoLocation?.longitude ?? ''}
              longitudeError={
                addressGeoLocationErrors[index]?.geoLocation?.longitude
                  ? pt('validation.geoLocation')
                  : undefined
              }
              longitudeId={
                index === 0 ? 'event-address-longitude' : `event-address-longitude-${index}`
              }
              reverseGeocodingEnabled={isReverseGeocodingEnabled}
              street={address.street ?? ''}
              streetId={index === 0 ? 'event-street' : `event-street-${index}`}
              zip={address.zip ?? ''}
              zipId={index === 0 ? 'event-zip' : `event-zip-${index}`}
              onAdditionChange={(value) =>
                setValue(`content.addresses.${index}.addition`, value, { shouldDirty: true })
              }
              onCityChange={(value) =>
                setValue(`content.addresses.${index}.city`, value, { shouldDirty: true })
              }
              onCoordinatesChange={(coordinates) => {
                setValue(`content.addresses.${index}.geoLocation.latitude`, coordinates.latitude, {
                  shouldDirty: true,
                });
                setValue(
                  `content.addresses.${index}.geoLocation.longitude`,
                  coordinates.longitude,
                  { shouldDirty: true }
                );
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
          </div>
        ))}
      </EventsDetailCard>

      <EventsDetailCard
        title={pt('cards.content.organizer.title')}
        description={pt('cards.content.organizer.description')}
      >
        <StudioField id="event-organizer-name" label={pt('fields.organizerName')}>
          <Input
            id="event-organizer-name"
            value={organizer.name ?? ''}
            onChange={(event) =>
              setValue('content.organizer.name', event.target.value, { shouldDirty: true })
            }
          />
        </StudioField>
        <StudioFieldGroup columns={2}>
          <StudioField id="event-organizer-email" label={pt('fields.email')}>
            <Input
              id="event-organizer-email"
              value={organizer.contact?.email ?? ''}
              onChange={(event) =>
                setValue(
                  'content.organizer.contact',
                  { ...(organizer.contact ?? {}), email: event.target.value },
                  { shouldDirty: true }
                )
              }
            />
          </StudioField>
          <StudioField id="event-organizer-phone" label={pt('fields.phone')}>
            <Input
              id="event-organizer-phone"
              value={organizer.contact?.phone ?? ''}
              onChange={(event) =>
                setValue(
                  'content.organizer.contact',
                  { ...(organizer.contact ?? {}), phone: event.target.value },
                  { shouldDirty: true }
                )
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
          latitudeError={
            organizerGeoLocationErrors?.latitude ? pt('validation.geoLocation') : undefined
          }
          latitudeId="event-organizer-latitude"
          longitude={organizer.address?.geoLocation?.longitude ?? ''}
          longitudeError={
            organizerGeoLocationErrors?.longitude ? pt('validation.geoLocation') : undefined
          }
          longitudeId="event-organizer-longitude"
          reverseGeocodingEnabled={isReverseGeocodingEnabled}
          street={organizer.address?.street ?? ''}
          streetId="event-organizer-street"
          zip={organizer.address?.zip ?? ''}
          zipId="event-organizer-zip"
          onAdditionChange={(value) =>
            setValue('content.organizer.address.addition', value, { shouldDirty: true })
          }
          onCityChange={(value) =>
            setValue('content.organizer.address.city', value, { shouldDirty: true })
          }
          onCoordinatesChange={(coordinates) => {
            setValue('content.organizer.address.geoLocation.latitude', coordinates.latitude, {
              shouldDirty: true,
            });
            setValue('content.organizer.address.geoLocation.longitude', coordinates.longitude, {
              shouldDirty: true,
            });
          }}
          onLatitudeChange={(value) =>
            setValue('content.organizer.address.geoLocation.latitude', value, { shouldDirty: true })
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

      <EventsContactLinkSections pt={pt} />
      <EventsPriceSection pt={pt} />
    </div>
  );
}
