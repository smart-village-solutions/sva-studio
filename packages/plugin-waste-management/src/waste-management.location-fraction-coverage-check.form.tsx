import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField } from '@sva/studio-ui-react';
import { IconChecklist } from '@tabler/icons-react';
import type { FormEvent } from 'react';

import type { WasteLocationCoverageFractionsStatus } from './use-waste-master-data-state.js';

export const CoverageCheckForm = ({
  fractions,
  disabled,
  fractionId,
  startDate,
  endDate,
  onFractionChange,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
}: Readonly<{
  fractions: readonly WasteFractionRecord[];
  disabled?: boolean;
  fractionId: string;
  startDate: string;
  endDate: string;
  onFractionChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <form
      className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end"
      onSubmit={onSubmit}
      noValidate
    >
      <StudioField
        id="waste-location-coverage-fraction"
        label={pt('masterData.locationsWorkspace.coverage.fraction')}
      >
        <Select
          id="waste-location-coverage-fraction"
          value={fractionId}
          disabled={disabled}
          onChange={(event) => onFractionChange(event.target.value)}
        >
          <option value="">{pt('masterData.locationsWorkspace.coverage.fractionUnset')}</option>
          {fractions.map((fraction) => (
            <option key={fraction.id} value={fraction.id}>
              {fraction.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField
        id="waste-location-coverage-start"
        label={pt('masterData.locationsWorkspace.coverage.startDate')}
      >
        <Input
          id="waste-location-coverage-start"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </StudioField>
      <StudioField
        id="waste-location-coverage-end"
        label={pt('masterData.locationsWorkspace.coverage.endDate')}
      >
        <Input
          id="waste-location-coverage-end"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </StudioField>
      <Button type="submit" disabled={disabled}>
        <IconChecklist aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.coverage.check')}
      </Button>
    </form>
  );
};

export const CoverageFractionsAvailability = ({
  status,
  hasFractions,
}: Readonly<{
  status: WasteLocationCoverageFractionsStatus;
  hasFractions: boolean;
}>) => {
  const pt = usePluginTranslation('wasteManagement');

  if (status === 'loading' || status === 'idle') {
    return (
      <p className="mt-3 text-sm text-muted-foreground" role="status">
        {pt('masterData.locationsWorkspace.coverage.fractionsLoading')}
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p className="mt-3 text-sm text-destructive" role="alert">
        {pt('masterData.locationsWorkspace.coverage.fractionsLoadError')}
      </p>
    );
  }

  return hasFractions ? null : (
    <p className="mt-3 text-sm text-muted-foreground" role="status">
      {pt('masterData.locationsWorkspace.coverage.fractionsEmpty')}
    </p>
  );
};
