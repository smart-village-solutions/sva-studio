import { useFieldArray, useFormContext, useWatch, type UseFormSetValue } from 'react-hook-form';
import { Button } from '@sva/studio-ui-react';

import {
  createDefaultAddress,
  type EventAddressFormValue,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import { StudioDetailCard } from '@sva/studio-ui-react';
import {
  indexedId,
  optionalText,
  repeatedItemKey,
  RepeaterItem,
  type EventsContentTranslator as Translator,
} from './events.detail-content-section-fields.js';
import type { EventsMapCapabilities } from './events.detail-content-primary-sections.js';
import { EventsGeoAddressFields } from './events.geo-address-fields.js';

export const dirty = { shouldDirty: true } as const;
export type LocationSectionProps = Readonly<{
  createMode?: boolean;
  capabilities: EventsMapCapabilities;
  pt: Translator;
}>;
export type SetValue = UseFormSetValue<EventsDetailFormValues>;

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
        createMode={props.createMode}
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

export function EventsAddressSection({ capabilities, pt, createMode }: LocationSectionProps) {
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
    <StudioDetailCard
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
          createMode={createMode}
          capabilities={capabilities}
          index={index}
          invalidLatitude={Boolean(addressErrors[index]?.geoLocation?.latitude)}
          invalidLongitude={Boolean(addressErrors[index]?.geoLocation?.longitude)}
          pt={pt}
          setValue={setValue}
          onRemove={addresses.length > 1 ? () => addressesArray.remove(index) : undefined}
        />
      ))}
    </StudioDetailCard>
  );
}
