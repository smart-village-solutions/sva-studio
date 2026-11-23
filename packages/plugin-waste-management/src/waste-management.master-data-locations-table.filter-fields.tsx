import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select } from '@sva/studio-ui-react';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';
import { locationSortColumns } from './waste-management.master-data-locations-table.views.js';
import type {
  LocationFilters,
  useLocationFilterDraft,
} from './waste-management.master-data-locations-table.filter-draft.js';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';

type DraftState = ReturnType<typeof useLocationFilterDraft>;
type AvailableTours = WasteMasterDataLocationsTableProps['availableTours'];

const AddressFilterFields = ({
  addressOptions,
  setAddress,
  draft,
}: Pick<DraftState, 'addressOptions' | 'setAddress'> & { readonly draft: LocationFilters }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      {addressOptions.map(({ key, field, choices, label }) => (
        <label key={key} className="grid gap-1 text-sm">
          {pt(`masterData.collectionLocations.fields.${field}`)}
          <Select
            value={draft[key] ?? ''}
            onChange={(event) => setAddress(key, event.currentTarget.value)}
          >
            <option value="">
              {pt(
                field === 'streetId'
                  ? 'masterData.collectionLocations.meta.allStreets'
                  : field === 'houseNumberId'
                    ? 'masterData.collectionLocations.meta.allHouseNumbers'
                    : 'filters.any'
              )}
            </option>
            {choices.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {label(entry.id)}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </>
  );
};

const LocationTourField = ({
  tourId,
  tours,
  availableTours,
  onChange,
}: {
  readonly tourId?: string;
  readonly tours: AvailableTours;
  readonly availableTours: AvailableTours;
  readonly onChange: (tourId?: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <label className="grid gap-1 text-sm">
      {pt('masterData.locationsWorkspace.filters.tour')}
      <Select
        value={tourId ?? ''}
        onChange={(event) => onChange(event.currentTarget.value || undefined)}
      >
        <option value="">{pt('masterData.locationsWorkspace.filters.allTours')}</option>
        {tourId && !tours.some((tour) => tour.id === tourId) ? (
          <option value={tourId}>
            {availableTours.find((tour) => tour.id === tourId)?.name ?? tourId}
          </option>
        ) : null}
        {tours.map((tour) => (
          <option key={tour.id} value={tour.id}>
            {formatTourSelectionLabel(pt, tour)}
          </option>
        ))}
      </Select>
    </label>
  );
};

const LocationTourFilterFields = ({
  draft,
  edit,
  tours,
  availableTours,
  year,
}: Pick<DraftState, 'edit' | 'tours' | 'year'> & {
  readonly draft: LocationFilters;
  readonly availableTours: AvailableTours;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <label className="grid gap-1 text-sm">
        {pt('filters.statusLabel')}
        <Select
          value={draft.status}
          onChange={(event) =>
            edit({ status: event.currentTarget.value as LocationFilters['status'] })
          }
        >
          {(['all', 'active', 'inactive'] as const).map((key) => (
            <option key={key} value={key}>
              {pt(`filters.status.${key}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm">
        {pt('masterData.locationsWorkspace.filters.tourYear')}
        <Input
          type="number"
          min={2000}
          max={2100}
          value={year ?? ''}
          onChange={(event) =>
            edit({
              locationYear: event.currentTarget.value
                ? event.currentTarget.valueAsNumber
                : undefined,
            })
          }
        />
      </label>
      <label className="grid gap-1 text-sm">
        {pt('masterData.locationsWorkspace.filters.tourStatus')}
        <Select
          value={draft.locationTourStatus ?? ''}
          onChange={(event) =>
            edit({
              locationTourStatus: (event.currentTarget.value ||
                undefined) as LocationFilters['locationTourStatus'],
            })
          }
        >
          <option value="">{pt('masterData.locationsWorkspace.filters.allStatuses')}</option>
          {(['draft', 'published', 'archived'] as const).map((key) => (
            <option key={key} value={key}>
              {pt(`masterData.locationsWorkspace.filters.${key}`)}
            </option>
          ))}
        </Select>
      </label>
      <LocationTourField
        tourId={draft.tourId}
        tours={tours}
        availableTours={availableTours}
        onChange={(tourId) => edit({ tourId })}
      />
    </>
  );
};

const LocationSortFields = ({
  sort,
  setSort,
  direction,
  setDirection,
}: Pick<DraftState, 'sort' | 'setSort' | 'direction' | 'setDirection'>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <label className="grid gap-1 text-sm">
        {pt('masterData.locationsWorkspace.sorting.label')}
        <Select
          value={sort}
          onChange={(event) => setSort(event.currentTarget.value as typeof sort)}
        >
          <option value="address">{pt('masterData.locationsWorkspace.sorting.criteria')}</option>
          <option value="addressWithRegion">
            {pt('masterData.locationsWorkspace.sorting.criteriaWithRegion')}
          </option>
          {locationSortColumns.map(([id, label]) => (
            <option key={id} value={id}>
              {id === 'tourCount'
                ? pt('filters.sortByTourCount')
                : pt(`masterData.locationsWorkspace.table.${label}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="grid gap-1 text-sm">
        {pt('filters.sortDirection')}
        <Select
          value={direction}
          onChange={(event) => setDirection(event.currentTarget.value as typeof direction)}
        >
          <option value="asc">{pt('masterData.locationsWorkspace.sorting.ascending')}</option>
          <option value="desc">{pt('masterData.locationsWorkspace.sorting.descending')}</option>
        </Select>
      </label>
    </>
  );
};

export const WasteLocationFilterFields = ({
  draft,
  state,
  availableTours,
}: {
  readonly draft: LocationFilters;
  readonly state: DraftState;
  readonly availableTours: AvailableTours;
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <AddressFilterFields
      draft={draft}
      addressOptions={state.addressOptions}
      setAddress={state.setAddress}
    />
    <LocationTourFilterFields
      draft={draft}
      edit={state.edit}
      tours={state.tours}
      year={state.year}
      availableTours={availableTours}
    />
    <LocationSortFields
      sort={state.sort}
      setSort={state.setSort}
      direction={state.direction}
      setDirection={state.setDirection}
    />
  </div>
);
