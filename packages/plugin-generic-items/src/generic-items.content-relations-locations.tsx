import { Button } from '@sva/studio-ui-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { GenericItemsGeoLocationFields } from './generic-items.geo-location-fields.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

type GeoConfig = Readonly<{
  isGeocodingEnabled: boolean;
  isReverseGeocodingEnabled: boolean;
  isMapEnabled: boolean;
  mapStyleUrl: string;
}>;

const LocationGeoFields = ({
  labels,
  index,
  location,
  config,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  location: GenericItemsDetailFormValues['locations'][number];
  config: GeoConfig;
}>) => {
  const { setValue } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <GenericItemsGeoLocationFields
      pt={(key) => labels[key] ?? key}
      name={location.name}
      nameId={`generic-item-location-name-${index}`}
      department={location.department}
      departmentId={`generic-item-location-department-${index}`}
      district={location.district}
      districtId={`generic-item-location-district-${index}`}
      regionName={location.regionName}
      regionNameId={`generic-item-location-region-name-${index}`}
      state={location.state}
      stateId={`generic-item-location-state-${index}`}
      geocodingEnabled={config.isGeocodingEnabled}
      mapEnabled={config.isMapEnabled}
      mapStyleUrl={config.mapStyleUrl}
      latitude={location.latitude}
      latitudeId={`generic-item-location-latitude-${index}`}
      longitude={location.longitude}
      longitudeId={`generic-item-location-longitude-${index}`}
      reverseGeocodingEnabled={config.isReverseGeocodingEnabled}
      onNameChange={(value) => setValue(`locations.${index}.name`, value, { shouldDirty: true })}
      onDepartmentChange={(value) =>
        setValue(`locations.${index}.department`, value, { shouldDirty: true })
      }
      onDistrictChange={(value) =>
        setValue(`locations.${index}.district`, value, { shouldDirty: true })
      }
      onRegionNameChange={(value) =>
        setValue(`locations.${index}.regionName`, value, { shouldDirty: true })
      }
      onStateChange={(value) => setValue(`locations.${index}.state`, value, { shouldDirty: true })}
      onCoordinatesChange={(coordinates) => {
        setValue(`locations.${index}.latitude`, coordinates.latitude, {
          shouldDirty: true,
        });
        setValue(`locations.${index}.longitude`, coordinates.longitude, {
          shouldDirty: true,
        });
      }}
      onLatitudeChange={(value) =>
        setValue(`locations.${index}.latitude`, value, { shouldDirty: true })
      }
      onLongitudeChange={(value) =>
        setValue(`locations.${index}.longitude`, value, { shouldDirty: true })
      }
    />
  );
};

const LocationRow = ({
  labels,
  index,
  location,
  canRemove,
  onRemove,
  config,
}: Readonly<{
  labels: Record<string, string>;
  index: number;
  location: GenericItemsDetailFormValues['locations'][number];
  canRemove: boolean;
  onRemove: () => void;
  config: GeoConfig;
}>) => {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{labels.locationItem}</p>
        {canRemove ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onRemove()}>
            {labels.remove}
          </Button>
        ) : null}
      </div>
      <LocationGeoFields labels={labels} index={index} location={location} config={config} />
    </div>
  );
};

export const GenericItemsContentLocations = ({
  labels,
  config,
}: Readonly<{ labels: Record<string, string>; config: GeoConfig }>) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  const locationsArray = useFieldArray({ control, name: 'locations' });
  const locations = useWatch({ control, name: 'locations' }) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{labels.locations}</p>
          <p className="text-sm text-muted-foreground">{labels.locationsHelp}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            locationsArray.append({
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              latitude: '',
              longitude: '',
            })
          }
        >
          {labels.addLocation}
        </Button>
      </div>
      {locations.map((location, index) => (
        <LocationRow
          key={locationsArray.fields[index]?.id ?? `fallback-location-${index}`}
          labels={labels}
          index={index}
          location={location}
          canRemove={locations.length > 1}
          onRemove={() => locationsArray.remove(index)}
          config={config}
        />
      ))}
    </div>
  );
};
