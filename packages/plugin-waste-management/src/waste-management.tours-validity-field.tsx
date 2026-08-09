import type { WasteTourValidityDateOperation } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select, StudioField } from '@sva/studio-ui-react';

export type ValidityMode = WasteTourValidityDateOperation['mode'];

export const ValidityModeField = ({
  id,
  label,
  mode,
  date,
  dateLabel,
  disabled,
  allowClear = true,
  onModeChange,
  onDateChange,
}: Readonly<{
  id: string;
  label: string;
  mode: ValidityMode;
  date: string;
  dateLabel: string;
  disabled: boolean;
  allowClear?: boolean;
  onModeChange: (mode: ValidityMode) => void;
  onDateChange: (date: string) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <StudioField id={`${id}-mode`} label={label}>
        <Select
          id={`${id}-mode`}
          value={mode}
          disabled={disabled}
          onChange={(event) => onModeChange(event.target.value as ValidityMode)}
        >
          <option value="unchanged">{pt('tours.bulkValidityDialog.modes.unchanged')}</option>
          <option value="set">{pt('tours.bulkValidityDialog.modes.set')}</option>
          {allowClear ? (
            <option value="clear">{pt('tours.bulkValidityDialog.modes.clear')}</option>
          ) : null}
        </Select>
      </StudioField>
      {mode === 'set' ? (
        <StudioField id={`${id}-date`} label={dateLabel} required>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            disabled={disabled}
            required
            onChange={(event) => onDateChange(event.target.value)}
          />
        </StudioField>
      ) : null}
    </>
  );
};
