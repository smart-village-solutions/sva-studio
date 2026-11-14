import { toDatetimeLocalValue } from '@sva/plugin-sdk';
import { isCalendarDate, usePluginTranslation } from '@sva/plugin-sdk';
import { DateInput, Input, Select, StudioField } from '@sva/studio-ui-react';
import { type WasteTourStatus } from '@sva/waste-management-contracts';
import { useId, type ReactNode } from 'react';

import type { WasteManagementTourValidityPeriod } from './search-params.js';

type WasteToursToolbarFilterFieldsProps = {
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly draftQuery: string;
  readonly draftStatus: 'all' | WasteTourStatus;
  readonly draftTourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | WasteTourStatus) => void;
  readonly onDraftTourValidityPeriodChange: (value: WasteManagementTourValidityPeriod) => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
};

const WasteToursToolbarFilterField = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => {
  const id = useId();
  return (
    <StudioField
      id={id}
      label={label}
      controlProps={{ id }}
      className="flex min-w-44 flex-col gap-2 text-sm"
    >
      {children}
    </StudioField>
  );
};

const TourValidityPeriodField = ({
  value,
  onChange,
}: Readonly<{
  value: WasteManagementTourValidityPeriod;
  onChange: (value: WasteManagementTourValidityPeriod) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const referenceYear = Number(toDatetimeLocalValue(new Date().toISOString()).slice(0, 4));
  return (
    <WasteToursToolbarFilterField label={pt('tours.filters.validityPeriodLabel')}>
      <Select
        aria-label={pt('tours.filters.validityPeriodLabel')}
        value={value}
        className="h-10 rounded-lg"
        onChange={(event) => onChange(event.target.value as WasteManagementTourValidityPeriod)}
      >
        <option value="all">{pt('tours.filters.validityPeriod.all')}</option>
        <option value="previous">
          {pt('tours.filters.validityPeriod.previous', { year: referenceYear - 1 })}
        </option>
        <option value="current">
          {pt('tours.filters.validityPeriod.current', { year: referenceYear })}
        </option>
        <option value="next">
          {pt('tours.filters.validityPeriod.next', { year: referenceYear + 1 })}
        </option>
      </Select>
    </WasteToursToolbarFilterField>
  );
};

const WasteToursToolbarBasicFilterFields = ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourValidityPeriodChange,
  onDraftTourWasteFractionIdChange,
}: Pick<
  WasteToursToolbarFilterFieldsProps,
  | 'fractions'
  | 'draftQuery'
  | 'draftStatus'
  | 'draftTourValidityPeriod'
  | 'draftTourWasteFractionId'
  | 'onDraftQueryChange'
  | 'onDraftStatusChange'
  | 'onDraftTourValidityPeriodChange'
  | 'onDraftTourWasteFractionIdChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <WasteToursToolbarFilterField label={pt('tours.filters.nameLabel')}>
        <Input
          aria-label={pt('tours.filters.nameLabel')}
          value={draftQuery}
          onChange={(event) => onDraftQueryChange(event.target.value)}
          placeholder={pt('tours.filters.namePlaceholder')}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.statusLabel')}>
        <Select
          aria-label={pt('tours.filters.statusLabel')}
          value={draftStatus}
          className="h-10 rounded-lg"
          onChange={(event) => onDraftStatusChange(event.target.value as 'all' | WasteTourStatus)}
        >
          <option value="all">{pt('tours.filters.status.all')}</option>
          <option value="draft">{pt('tours.status.draft')}</option>
          <option value="published">{pt('tours.status.published')}</option>
          <option value="archived">{pt('tours.status.archived')}</option>
        </Select>
      </WasteToursToolbarFilterField>
      <TourValidityPeriodField
        value={draftTourValidityPeriod}
        onChange={onDraftTourValidityPeriodChange}
      />
      <WasteToursToolbarFilterField label={pt('tours.filters.fractionLabel')}>
        <Select
          aria-label={pt('tours.filters.fractionLabel')}
          value={draftTourWasteFractionId ?? ''}
          className="h-10 rounded-lg"
          onChange={(event) => onDraftTourWasteFractionIdChange(event.target.value || undefined)}
        >
          <option value="">{pt('tours.filters.fractionAll')}</option>
          {fractions.map((fraction) => (
            <option key={fraction.id} value={fraction.id}>
              {fraction.name}
            </option>
          ))}
        </Select>
      </WasteToursToolbarFilterField>
    </>
  );
};

const WasteToursToolbarDateFilterFields = ({
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
}: Pick<
  WasteToursToolbarFilterFieldsProps,
  | 'draftFirstDateFrom'
  | 'draftFirstDateTo'
  | 'draftEndDateFrom'
  | 'draftEndDateTo'
  | 'onDraftFirstDateFromChange'
  | 'onDraftFirstDateToChange'
  | 'onDraftEndDateFromChange'
  | 'onDraftEndDateToChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <WasteToursToolbarFilterField label={pt('tours.filters.firstDateFromLabel')}>
        <DateInput
          id="waste-tour-filter-date-1"
          aria-label={pt('tours.filters.firstDateFromLabel')}
          value={draftFirstDateFrom ?? ''}
          onValueChange={(value) => {
            if (!value || isCalendarDate(value)) onDraftFirstDateFromChange(value || undefined);
          }}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.firstDateToLabel')}>
        <DateInput
          id="waste-tour-filter-date-2"
          aria-label={pt('tours.filters.firstDateToLabel')}
          value={draftFirstDateTo ?? ''}
          onValueChange={(value) => {
            if (!value || isCalendarDate(value)) onDraftFirstDateToChange(value || undefined);
          }}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.endDateFromLabel')}>
        <DateInput
          id="waste-tour-filter-date-3"
          aria-label={pt('tours.filters.endDateFromLabel')}
          value={draftEndDateFrom ?? ''}
          onValueChange={(value) => {
            if (!value || isCalendarDate(value)) onDraftEndDateFromChange(value || undefined);
          }}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.endDateToLabel')}>
        <DateInput
          id="waste-tour-filter-date-4"
          aria-label={pt('tours.filters.endDateToLabel')}
          value={draftEndDateTo ?? ''}
          onValueChange={(value) => {
            if (!value || isCalendarDate(value)) onDraftEndDateToChange(value || undefined);
          }}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
    </>
  );
};

export const WasteToursToolbarFilterFields = ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourValidityPeriodChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
}: WasteToursToolbarFilterFieldsProps) => {
  return (
    <div className="flex flex-col gap-3">
      <WasteToursToolbarBasicFilterFields
        fractions={fractions}
        draftQuery={draftQuery}
        draftStatus={draftStatus}
        draftTourValidityPeriod={draftTourValidityPeriod}
        draftTourWasteFractionId={draftTourWasteFractionId}
        onDraftQueryChange={onDraftQueryChange}
        onDraftStatusChange={onDraftStatusChange}
        onDraftTourValidityPeriodChange={onDraftTourValidityPeriodChange}
        onDraftTourWasteFractionIdChange={onDraftTourWasteFractionIdChange}
      />
      <WasteToursToolbarDateFilterFields
        draftFirstDateFrom={draftFirstDateFrom}
        draftFirstDateTo={draftFirstDateTo}
        draftEndDateFrom={draftEndDateFrom}
        draftEndDateTo={draftEndDateTo}
        onDraftFirstDateFromChange={onDraftFirstDateFromChange}
        onDraftFirstDateToChange={onDraftFirstDateToChange}
        onDraftEndDateFromChange={onDraftEndDateFromChange}
        onDraftEndDateToChange={onDraftEndDateToChange}
      />
    </div>
  );
};
