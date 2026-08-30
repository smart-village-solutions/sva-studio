import { useFieldArray, useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { Button, StudioFieldGroup } from '@sva/studio-ui-react';

import {
  createDefaultAddress,
  createDefaultContact,
  createDefaultOrganizer,
  type EventAddressFormValue,
  type EventOrganizerFormValue,
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
import type { EventsMapCapabilities } from './events.detail-content-primary-sections.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';

const dirty = { shouldDirty: true } as const;
type LocationSectionProps = Readonly<{ capabilities: EventsMapCapabilities; pt: Translator }>;
type SetValue = UseFormSetValue<EventsDetailFormValues>;

type AddressItemProps = LocationSectionProps &
  Readonly<{
    address: EventAddressFormValue;
    index: number;
    invalidLatitude: boolean;
    invalidLongitude: boolean;
    onRemove?: () => void;
    setValue: SetValue;
  }>;

function AddressItem(props: AddressItemProps) {
  const { address, capabilities, index, onRemove, pt, setValue } = props;
  const path = `content.addresses.${index}` as const;
  return (
    <RepeaterItem
      title={pt('cards.content.addresses.itemTitle')}
      removeLabel={pt('actions.remove')}
      onRemove={onRemove}
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
        latitudeError={props.invalidLatitude ? pt('validation.geoLocation') : undefined}
        latitudeId={indexedId('event-address-latitude', index)}
        longitude={optionalText(address.geoLocation?.longitude)}
        longitudeError={props.invalidLongitude ? pt('validation.geoLocation') : undefined}
        longitudeId={indexedId('event-address-longitude', index)}
        reverseGeocodingEnabled={capabilities.reverseGeocodingEnabled}
        street={optionalText(address.street)}
        streetId={indexedId('event-street', index)}
        zip={optionalText(address.zip)}
        zipId={indexedId('event-zip', index)}
        onAdditionChange={(value) => setValue(`${path}.addition`, value, dirty)}
        onCityChange={(value) => setValue(`${path}.city`, value, dirty)}
        onCoordinatesChange={({ latitude, longitude }) => {
          setValue(`${path}.geoLocation.latitude`, latitude, dirty);
          setValue(`${path}.geoLocation.longitude`, longitude, dirty);
        }}
        onLatitudeChange={(value) => setValue(`${path}.geoLocation.latitude`, value, dirty)}
        onLongitudeChange={(value) => setValue(`${path}.geoLocation.longitude`, value, dirty)}
        onStreetChange={(value) => setValue(`${path}.street`, value, dirty)}
        onZipChange={(value) => setValue(`${path}.zip`, value, dirty)}
      />
    </RepeaterItem>
  );
}

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
        <AddressItem
          key={repeatedItemKey(addressesArray.fields[index]?.id, `fallback-address-${index}`)}
          address={address}
          capabilities={capabilities}
          index={index}
          invalidLatitude={Boolean(addressErrors[index]?.geoLocation?.latitude)}
          invalidLongitude={Boolean(addressErrors[index]?.geoLocation?.longitude)}
          pt={pt}
          setValue={setValue}
          onRemove={addresses.length > 1 ? () => addressesArray.remove(index) : undefined}
        />
      ))}
    </EventsDetailCard>
  );
}

const normalizeOrganizer = (organizer: EventOrganizerFormValue) => {
  const address = organizer.address ?? createDefaultAddress();
  return {
    address,
    contact: organizer.contact ?? createDefaultContact(),
    geoLocation: address.geoLocation ?? { latitude: '', longitude: '' },
  };
};

function OrganizerContactFields({
  organizer,
  pt,
  setValue,
}: Readonly<{
  organizer: EventOrganizerFormValue;
  pt: Translator;
  setValue: SetValue;
}>) {
  const contact = organizer.contact ?? createDefaultContact();
  const update = (key: 'email' | 'phone', value: string) =>
    setValue('content.organizer.contact', { ...(organizer.contact ?? {}), [key]: value }, dirty);
  return (
    <>
      <ContentInput
        id="event-organizer-name"
        label={pt('fields.organizerName')}
        value={organizer.name}
        onChange={(value) => setValue('content.organizer.name', value, dirty)}
      />
      <StudioFieldGroup columns={2}>
        <ContentInput
          id="event-organizer-email"
          label={pt('fields.email')}
          value={contact.email}
          onChange={(value) => update('email', value)}
        />
        <ContentInput
          id="event-organizer-phone"
          label={pt('fields.phone')}
          value={contact.phone}
          onChange={(value) => update('phone', value)}
        />
      </StudioFieldGroup>
    </>
  );
}

export function EventsOrganizerSection({ capabilities, pt }: LocationSectionProps) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<EventsDetailFormValues>();
  const organizer = useWatch({ control, name: 'content.organizer' }) ?? createDefaultOrganizer();
  const { address, geoLocation } = normalizeOrganizer(organizer);
  const organizerErrors = errors.content?.organizer?.address?.geoLocation;
  const path = 'content.organizer.address' as const;
  return (
    <EventsDetailCard
      title={pt('cards.content.organizer.title')}
      description={pt('cards.content.organizer.description')}
    >
      <OrganizerContactFields organizer={organizer} pt={pt} setValue={setValue} />
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
        onAdditionChange={(value) => setValue(`${path}.addition`, value, dirty)}
        onCityChange={(value) => setValue(`${path}.city`, value, dirty)}
        onCoordinatesChange={({ latitude, longitude }) => {
          setValue(`${path}.geoLocation.latitude`, latitude, dirty);
          setValue(`${path}.geoLocation.longitude`, longitude, dirty);
        }}
        onLatitudeChange={(value) => setValue(`${path}.geoLocation.latitude`, value, dirty)}
        onLongitudeChange={(value) => setValue(`${path}.geoLocation.longitude`, value, dirty)}
        onStreetChange={(value) => setValue(`${path}.street`, value, dirty)}
        onZipChange={(value) => setValue(`${path}.zip`, value, dirty)}
      />
    </EventsDetailCard>
  );
}
