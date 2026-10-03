import type { Dispatch, SetStateAction } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input } from '@sva/studio-ui-react';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';

type PickerProps = Readonly<{
  assignment: TourDateLocationAssignmentFormState;
  disabled: boolean;
  locations: readonly { id: string; label: string }[];
  locationLabels: ReadonlyMap<string, string>;
  activeLocationPickerId: string | null;
  setActiveLocationPickerId: Dispatch<SetStateAction<string | null>>;
  locationSearchValues: Readonly<Record<string, string>>;
  setLocationSearchValues: Dispatch<SetStateAction<Record<string, string>>>;
  duplicateAssignmentId: string | null;
  updateAssignment: (id: string, patch: Partial<TourDateLocationAssignmentFormState>) => void;
}>;

type OptionsProps = Pick<
  PickerProps,
  | 'assignment'
  | 'locations'
  | 'setActiveLocationPickerId'
  | 'setLocationSearchValues'
  | 'updateAssignment'
> & { readonly searchValue: string };

const normalizeSearchValue = (value: string) => value.trim().toLocaleLowerCase('de-DE');

const TourCustomDateLocationOptions = ({
  assignment,
  locations,
  searchValue,
  setActiveLocationPickerId,
  setLocationSearchValues,
  updateAssignment,
}: OptionsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const query = normalizeSearchValue(searchValue);
  const visibleLocations = locations.filter(
    (location) => query.length === 0 || normalizeSearchValue(location.label).includes(query)
  );
  const selectLocation = (locationId: string, label: string) => {
    setLocationSearchValues((current) => ({ ...current, [assignment.id]: label }));
    setActiveLocationPickerId(null);
    updateAssignment(assignment.id, { locationId });
  };

  return (
    <div
      id={`assignment-location-options-${assignment.id}`}
      role="listbox"
      className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-2 shadow-lg"
    >
      <button
        type="button"
        role="option"
        aria-selected={assignment.locationId.length === 0}
        className={[
          'flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition-colors',
          assignment.locationId.length === 0
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-accent/70',
        ].join(' ')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectLocation('', '')}
      >
        {pt('tours.customDates.fields.locationPlaceholder')}
      </button>
      {visibleLocations.map((location) => (
        <button
          key={location.id}
          type="button"
          role="option"
          aria-selected={assignment.locationId === location.id}
          className={[
            'flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition-colors',
            assignment.locationId === location.id
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-accent/70',
          ].join(' ')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectLocation(location.id, location.label)}
        >
          {location.label}
        </button>
      ))}
      {visibleLocations.length === 0 && query.length > 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {pt('tours.customDates.fields.locationSearchEmpty')}
        </p>
      ) : null}
    </div>
  );
};

export const TourCustomDateLocationPicker = ({
  assignment,
  disabled,
  locations,
  locationLabels,
  activeLocationPickerId,
  setActiveLocationPickerId,
  locationSearchValues,
  setLocationSearchValues,
  duplicateAssignmentId,
  updateAssignment,
}: PickerProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <fieldset
      className="space-y-2"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof HTMLElement && event.currentTarget.contains(nextTarget)) return;
        setActiveLocationPickerId((current) => (current === assignment.id ? null : current));
      }}
    >
      <legend className="sr-only">{pt('tours.customDates.fields.location')}</legend>
      <label
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        htmlFor={`assignment-location-${assignment.id}`}
      >
        {pt('tours.customDates.fields.location')}
      </label>
      <div className="relative">
        <Input
          id={`assignment-location-${assignment.id}`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={activeLocationPickerId === assignment.id}
          aria-controls={`assignment-location-options-${assignment.id}`}
          value={
            locationSearchValues[assignment.id] ?? locationLabels.get(assignment.locationId) ?? ''
          }
          disabled={disabled}
          onFocus={() => setActiveLocationPickerId(assignment.id)}
          onChange={(event) => {
            setActiveLocationPickerId(assignment.id);
            setLocationSearchValues((current) => ({
              ...current,
              [assignment.id]: event.target.value,
            }));
          }}
          placeholder={pt('tours.customDates.fields.locationSearchPlaceholder')}
        />
        {activeLocationPickerId === assignment.id ? (
          <TourCustomDateLocationOptions
            assignment={assignment}
            locations={locations}
            searchValue={locationSearchValues[assignment.id] ?? ''}
            setActiveLocationPickerId={setActiveLocationPickerId}
            setLocationSearchValues={setLocationSearchValues}
            updateAssignment={updateAssignment}
          />
        ) : null}
      </div>
      {duplicateAssignmentId === assignment.id ? (
        <p className="text-xs text-destructive">
          {pt('tours.customDates.messages.duplicateLocation')}
        </p>
      ) : null}
    </fieldset>
  );
};
