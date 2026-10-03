import { Button, Input, StudioField } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { GenericItemsGeoAddressFields } from './generic-items.geo-address-fields.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

type GeoConfig = Readonly<{
  isGeocodingEnabled: boolean;
  isReverseGeocodingEnabled: boolean;
  isMapEnabled: boolean;
  mapStyleUrl: string;
}>;

const AddressGeoFields = ({
  labels,
  index,
  address,
  config,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  address: GenericItemsDetailFormValues['addresses'][number];
  config: GeoConfig;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <GenericItemsGeoAddressFields
      pt={(key) => labels[key] ?? key}
      addition={address.addition}
      additionId={`generic-item-address-addition-${index}`}
      city={address.city}
      cityId={`generic-item-address-city-${index}`}
      geocodingEnabled={config.isGeocodingEnabled}
      mapEnabled={config.isMapEnabled}
      mapStyleUrl={config.mapStyleUrl}
      latitude={address.latitude}
      latitudeId={`generic-item-address-latitude-${index}`}
      longitude={address.longitude}
      longitudeId={`generic-item-address-longitude-${index}`}
      reverseGeocodingEnabled={config.isReverseGeocodingEnabled}
      street={address.street}
      streetId={`generic-item-address-street-${index}`}
      zip={address.zip}
      zipId={`generic-item-address-zip-${index}`}
      onAdditionChange={(value) =>
        setValue(`addresses.${index}.addition`, value, { shouldDirty: true })
      }
      onCityChange={(value) => setValue(`addresses.${index}.city`, value, { shouldDirty: true })}
      onCoordinatesChange={(coordinates) => {
        setValue(`addresses.${index}.latitude`, coordinates.latitude, {
          shouldDirty: true,
        });
        setValue(`addresses.${index}.longitude`, coordinates.longitude, {
          shouldDirty: true,
        });
      }}
      onLatitudeChange={(value) =>
        setValue(`addresses.${index}.latitude`, value, { shouldDirty: true })
      }
      onLongitudeChange={(value) =>
        setValue(`addresses.${index}.longitude`, value, { shouldDirty: true })
      }
      onStreetChange={(value) =>
        setValue(`addresses.${index}.street`, value, { shouldDirty: true })
      }
      onZipChange={(value) => setValue(`addresses.${index}.zip`, value, { shouldDirty: true })}
    />
  );
};

const AddressRow = ({
  labels,
  index,
  address,
  canRemove,
  onRemove,
  config,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  address: GenericItemsDetailFormValues['addresses'][number];
  canRemove: boolean;
  onRemove: () => void;
  config: GeoConfig;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.addressItem}</p>
        {canRemove ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
            {labels.remove}
          </Button>
        ) : null}
      </div>
      <StudioField id={`generic-item-address-kind-${index}`} label={labels.addressKind}>
        <Input
          id={`generic-item-address-kind-${index}`}
          value={address.kind}
          onChange={(event) =>
            setValue(`addresses.${index}.kind`, event.target.value, { shouldDirty: true })
          }
        />
      </StudioField>
      <AddressGeoFields labels={labels} index={index} address={address} config={config} />
    </div>
  );
};

export const GenericItemsContentAddresses = ({
  labels,
  config,
}: Readonly<{ labels: Record<string, string>; config: GeoConfig }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const addressesArray = useFieldArray({ control, name: 'addresses' });
  const addresses = useWatch({ control, name: 'addresses' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.addresses}</p>
          <p className="text-sm text-muted-foreground">{labels.addressesHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            addressesArray.append({
              addition: '',
              street: '',
              zip: '',
              city: '',
              kind: '',
              latitude: '',
              longitude: '',
            })
          }
        >
          {labels.addAddress}
        </Button>
      </div>
      {addresses.map((address, index) => (
        <AddressRow
          key={addressesArray.fields[index]?.id ?? `fallback-address-${index}`}
          labels={labels}
          index={index}
          address={address}
          canRemove={addresses.length > 1}
          onRemove={() => addressesArray.remove(index)}
          config={config}
        />
      ))}
    </div>
  );
};
