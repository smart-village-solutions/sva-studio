import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { LocationTourLinkFormState } from './waste-management.tours.shared.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

export const TourAssignmentsDialog = ({
  open,
  mode,
  form,
  tour,
  locations,
  tours,
  saving,
  loading = false,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: LocationTourLinkFormState;
  readonly tour: WasteTourRecord | null;
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly loading?: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>, selectedLocationIds: readonly string[]) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<readonly string[]>([]);

  const effectiveTourId = tour?.id ?? form.tourId;
  const assignedLocationIds = useMemo(
    () => locations.filter((location) => location.assignedLinkId).map((location) => location.id),
    [locations]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchQuery('');
    setRegionFilter('');
    setCityFilter('');
    setStreetFilter('');
    setSelectedLocationIds(assignedLocationIds);
  }, [assignedLocationIds, effectiveTourId, open]);

  useEffect(() => {
    const availableLocationIds = new Set(locations.map((location) => location.id));
    setSelectedLocationIds((current) => current.filter((locationId) => availableLocationIds.has(locationId)));
  }, [locations]);

  const regionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter((location) => location.regionId && location.regionName)
            .map((location) => [location.regionId, location.regionName] as const)
        ),
      ),
    [locations]
  );
  const cityOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter((location) => !regionFilter || location.regionId === regionFilter)
            .map((location) => [location.cityId, location.cityName] as const)
        ),
      ),
    [locations, regionFilter]
  );
  const streetOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter((location) => (!regionFilter || location.regionId === regionFilter) && (!cityFilter || location.cityId === cityFilter))
            .map((location) => [location.streetId, location.streetName] as const)
        ),
      ),
    [cityFilter, locations, regionFilter]
  );

  const filteredLocations = useMemo(
    () =>
      locations.filter((location) => {
        if (regionFilter && location.regionId !== regionFilter) {
          return false;
        }
        if (cityFilter && location.cityId !== cityFilter) {
          return false;
        }
        if (streetFilter && location.streetId !== streetFilter) {
          return false;
        }
        if (!searchQuery.trim()) {
          return true;
        }
        return [location.label, location.regionName, location.cityName, location.streetName]
          .filter((value) => value.length > 0)
          .some((value) => matchesSearch(value, searchQuery.trim()));
      }),
    [cityFilter, locations, regionFilter, searchQuery, streetFilter]
  );

  const visibleLocationIds = filteredLocations.map((location) => location.id);
  const visibleLocationIdSet = new Set(visibleLocationIds);
  const allVisibleSelected =
    visibleLocationIds.length > 0 && visibleLocationIds.every((locationId) => selectedLocationIds.includes(locationId));
  const someVisibleSelected = visibleLocationIds.some((locationId) => selectedLocationIds.includes(locationId));
  const hiddenSelectedCount = selectedLocationIds.filter((locationId) => !visibleLocationIdSet.has(locationId)).length;

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedLocationIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleLocationIds]));
      }
      return current.filter((locationId) => !visibleLocationIdSet.has(locationId));
    });
  };

  const toggleSelectedLocation = (locationId: string, checked: boolean) => {
    setSelectedLocationIds((current) =>
      checked ? (current.includes(locationId) ? current : [...current, locationId]) : current.filter((value) => value !== locationId)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,1280px)] max-w-none overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col">
          <div className="border-b border-border/60 bg-background px-6 py-5">
            <DialogHeader className="space-y-2">
              <DialogTitle>{mode === 'create' ? pt('tours.assignments.dialog.createTitle') : pt('tours.assignments.dialog.editTitle')}</DialogTitle>
              <DialogDescription>{tour ? pt('tours.assignments.dialog.description', { value: tour.name }) : pt('tours.assignments.dialog.descriptionFallback')}</DialogDescription>
            </DialogHeader>
          </div>

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => onSubmit(event, selectedLocationIds)}>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <StatusNotice message={message} />

              <StudioFieldGroup>
                <StudioField id="waste-tour-link-tour-id" label={pt('tours.assignments.fields.tourId')}>
                  <Select
                    id="waste-tour-link-tour-id"
                    value={form.tourId}
                    disabled={Boolean(tour)}
                    onChange={(event) => onChange({ tourId: event.target.value })}
                  >
                    <option value="">{pt('tours.assignments.fields.tourUnset')}</option>
                    {tours.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </Select>
                </StudioField>
                <StudioField id="waste-tour-link-start-date" label={pt('tours.assignments.fields.startDate')}>
                  <Input id="waste-tour-link-start-date" type="date" value={form.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
                </StudioField>
                <StudioField id="waste-tour-link-end-date" label={pt('tours.assignments.fields.endDate')}>
                  <Input id="waste-tour-link-end-date" type="date" value={form.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
                </StudioField>
              </StudioFieldGroup>

              <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <StudioField id="waste-tour-assignment-search" label={pt('filters.searchLabel')}>
                      <Input
                        id="waste-tour-assignment-search"
                        value={searchQuery}
                        placeholder={pt('filters.searchPlaceholder')}
                        onChange={(event) => setSearchQuery(event.target.value)}
                      />
                    </StudioField>
                  </div>
                  <div className="min-w-[180px]">
                    <StudioField id="waste-tour-assignment-region-filter" label={pt('masterData.collectionLocations.fields.regionId')}>
                      <Select
                        id="waste-tour-assignment-region-filter"
                        value={regionFilter}
                        onChange={(event) => {
                          setRegionFilter(event.target.value);
                          setCityFilter('');
                          setStreetFilter('');
                        }}
                      >
                        <option value="">{pt('masterData.collectionLocations.fields.regionUnset')}</option>
                        {regionOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </StudioField>
                  </div>
                  <div className="min-w-[180px]">
                    <StudioField id="waste-tour-assignment-city-filter" label={pt('masterData.collectionLocations.fields.cityId')}>
                      <Select
                        id="waste-tour-assignment-city-filter"
                        value={cityFilter}
                        onChange={(event) => {
                          setCityFilter(event.target.value);
                          setStreetFilter('');
                        }}
                      >
                        <option value="">{pt('masterData.collectionLocations.fields.cityUnset')}</option>
                        {cityOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </StudioField>
                  </div>
                  <div className="min-w-[180px]">
                    <StudioField id="waste-tour-assignment-street-filter" label={pt('masterData.collectionLocations.fields.streetId')}>
                      <Select id="waste-tour-assignment-street-filter" value={streetFilter} onChange={(event) => setStreetFilter(event.target.value)}>
                        <option value="">{pt('masterData.collectionLocations.fields.streetUnset')}</option>
                        {streetOptions.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </StudioField>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{pt('tours.assignments.workspace.availableTitle')}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{pt('tours.assignments.workspace.selectedCount', { value: selectedLocationIds.length })}</Badge>
                        <Badge variant="outline">{pt('tours.assignments.workspace.visibleCount', { value: filteredLocations.length })}</Badge>
                        {hiddenSelectedCount > 0 ? (
                          <Badge variant="outline">{pt('tours.assignments.workspace.hiddenSelectedCount', { value: hiddenSelectedCount })}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          aria-label={pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}
                          checked={allVisibleSelected}
                          indeterminate={!allVisibleSelected && someVisibleSelected}
                          onChange={(event) => toggleSelectAllVisible(event.currentTarget.checked)}
                        />
                        <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('');
                          setRegionFilter('');
                          setCityFilter('');
                          setStreetFilter('');
                        }}
                      >
                        {pt('tours.assignments.actions.resetFilters')}
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/60">
                    {loading ? (
                      <div className="p-4 text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</div>
                    ) : filteredLocations.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">{pt('tours.assignments.workspace.noLocations')}</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredLocations.map((location) => {
                          const selected = selectedLocationIds.includes(location.id);
                          return (
                            <label key={location.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/20">
                              <Checkbox checked={selected} onChange={(event) => toggleSelectedLocation(location.id, event.currentTarget.checked)} />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{location.label}</span>
                                  {location.assignedLinkId ? <Badge>{pt('tours.assignments.workspace.assigned')}</Badge> : null}
                                  {!location.active ? <Badge variant="outline">{pt('filters.status.inactive')}</Badge> : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {[location.regionName, location.cityName, location.streetName].filter((value) => value.length > 0).join(' / ')}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {pt('tours.assignments.actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving || (!selectedLocationIds.length && assignedLocationIds.length === 0)}>
                {saving ? pt('tours.assignments.actions.saving') : mode === 'create' ? pt('tours.assignments.actions.create') : pt('tours.assignments.actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
