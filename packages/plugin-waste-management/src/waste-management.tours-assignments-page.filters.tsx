import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';

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
  onResetFilters: () => void;
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

export const TourAssignmentsPageFilters = ({
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
  onResetFilters,
}: FilterProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const activeFilters = [
    ['filters.searchLabel', searchQuery.trim()],
    ['masterData.collectionLocations.fields.regionId', regionOptions.find(([id]) => id === regionFilter)?.[1]],
    ['masterData.collectionLocations.fields.cityId', cityOptions.find(([id]) => id === cityFilter)?.[1]],
    ['masterData.collectionLocations.fields.streetId', streetOptions.find(([id]) => id === streetFilter)?.[1]],
  ] as const;
  return (
    <WastePanelTableTopBar
      activeFilters={activeFilters.map(([key, value]) =>
        value ? <span key={key}>{pt(key)} · {value}</span> : null
      )}
    >
      <div className="flex w-full flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <StudioField id="waste-tour-assignment-search" label={pt('filters.searchLabel')}>
            <Input
              id="waste-tour-assignment-search"
              value={searchQuery}
              placeholder={pt('tours.assignments.workspace.searchPlaceholder')}
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
          onChange={onRegionFilterChange}
        />
        <TourAssignmentLocationFilter
          id="waste-tour-assignment-city-filter"
          label={pt('masterData.collectionLocations.fields.cityId')}
          unsetLabel={pt('masterData.collectionLocations.fields.cityUnset')}
          value={cityFilter}
          options={cityOptions}
          onChange={onCityFilterChange}
        />
        <TourAssignmentLocationFilter
          id="waste-tour-assignment-street-filter"
          label={pt('masterData.collectionLocations.fields.streetId')}
          unsetLabel={pt('masterData.collectionLocations.fields.streetUnset')}
          value={streetFilter}
          options={streetOptions}
          onChange={onStreetFilterChange}
        />
        <Button
          type="button"
          variant="tertiary"
          disabled={!searchQuery && !regionFilter && !cityFilter && !streetFilter}
          onClick={onResetFilters}
        >
          {pt('tours.assignments.actions.resetFilters')}
        </Button>
      </div>
    </WastePanelTableTopBar>
  );
};
