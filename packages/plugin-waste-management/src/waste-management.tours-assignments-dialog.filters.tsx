import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select, StudioField } from '@sva/studio-ui-react';

type Option = readonly [string, string];
type FilterProps = Readonly<{
  searchQuery: string;
  regionFilter: string;
  cityFilter: string;
  streetFilter: string;
  regionOptions: readonly Option[];
  cityOptions: readonly Option[];
  streetOptions: readonly Option[];
  onSearchQueryChange: (value: string) => void;
  onRegionFilterChange: (value: string) => void;
  onCityFilterChange: (value: string) => void;
  onStreetFilterChange: (value: string) => void;
}>;

const TourAssignmentLocationFilter = ({
  id,
  label,
  unsetLabel,
  value,
  options,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly unsetLabel: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
}) => (
  <div className="min-w-[180px]">
    <StudioField id={id} label={label}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{unsetLabel}</option>
        {options.map(([optionId, name]) => (
          <option key={optionId} value={optionId}>
            {name}
          </option>
        ))}
      </Select>
    </StudioField>
  </div>
);

export const TourAssignmentsDialogFilters = ({
  searchQuery,
  regionFilter,
  cityFilter,
  streetFilter,
  regionOptions,
  cityOptions,
  streetOptions,
  onSearchQueryChange,
  onRegionFilterChange,
  onCityFilterChange,
  onStreetFilterChange,
}: FilterProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <StudioField id="waste-tour-assignment-search" label={pt('filters.searchLabel')}>
          <Input
            id="waste-tour-assignment-search"
            value={searchQuery}
            placeholder={pt('filters.searchPlaceholder')}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </StudioField>
      </div>
      <TourAssignmentLocationFilter
        id="waste-tour-assignment-region-filter"
        label={pt('masterData.collectionLocations.fields.regionId')}
        unsetLabel={pt('masterData.collectionLocations.fields.regionUnset')}
        value={regionFilter}
        options={regionOptions}
        onChange={(value) => {
          onRegionFilterChange(value);
          onCityFilterChange('');
          onStreetFilterChange('');
        }}
      />
      <TourAssignmentLocationFilter
        id="waste-tour-assignment-city-filter"
        label={pt('masterData.collectionLocations.fields.cityId')}
        unsetLabel={pt('masterData.collectionLocations.fields.cityUnset')}
        value={cityFilter}
        options={cityOptions}
        onChange={(value) => {
          onCityFilterChange(value);
          onStreetFilterChange('');
        }}
      />
      <TourAssignmentLocationFilter
        id="waste-tour-assignment-street-filter"
        label={pt('masterData.collectionLocations.fields.streetId')}
        unsetLabel={pt('masterData.collectionLocations.fields.streetUnset')}
        value={streetFilter}
        options={streetOptions}
        onChange={onStreetFilterChange}
      />
    </div>
  );
};
