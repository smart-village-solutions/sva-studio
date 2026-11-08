import { usePluginTranslation } from '@sva/plugin-sdk';
import { SearchableSelect } from '@sva/studio-ui-react';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';

type PickerProps = Readonly<{
  assignment: TourDateLocationAssignmentFormState;
  disabled: boolean;
  locations: readonly { id: string; label: string }[];
  locationLabels: ReadonlyMap<string, string>;
  duplicateAssignmentId: string | null;
  updateAssignment: (id: string, patch: Partial<TourDateLocationAssignmentFormState>) => void;
}>;

export const TourCustomDateLocationPicker = ({
  assignment,
  disabled,
  locations,
  locationLabels,
  duplicateAssignmentId,
  updateAssignment,
}: PickerProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const invalid = duplicateAssignmentId === assignment.id;
  const errorId = `assignment-location-${assignment.id}-error`;
  const selectedLabel = locationLabels.get(assignment.locationId);
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{pt('tours.customDates.fields.location')}</legend>
      <SearchableSelect
        id={`assignment-location-${assignment.id}`}
        label={pt('tours.customDates.fields.location')}
        value={assignment.locationId}
        disabled={disabled}
        ariaInvalid={invalid}
        describedBy={invalid ? errorId : undefined}
        placeholder={pt('tours.customDates.fields.locationPlaceholder')}
        searchPlaceholder={pt('tours.customDates.fields.locationSearchPlaceholder')}
        emptyText={pt('tours.customDates.fields.locationSearchEmpty')}
        clearLabel={pt('tours.customDates.actions.clearLocation')}
        options={locations.map((location) => ({ value: location.id, label: location.label }))}
        selectedOption={
          selectedLabel ? { value: assignment.locationId, label: selectedLabel } : null
        }
        onValueChange={(locationId) => updateAssignment(assignment.id, { locationId })}
      />
      {invalid ? (
        <p id={errorId} className="text-sm text-destructive">
          {pt('tours.customDates.messages.duplicateLocation')}
        </p>
      ) : null}
    </fieldset>
  );
};
