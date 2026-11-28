import { toDatetimeLocalValue } from '@sva/plugin-sdk';
import { isCalendarDate, usePluginTranslation } from '@sva/plugin-sdk';
import { DateInput, Input, Select, StudioField } from '@sva/studio-ui-react';
import { type WasteTourStatus } from '@sva/waste-management-contracts';
import { useId, type ReactNode } from 'react';

import type {
  WasteManagementSearchParams,
  WasteManagementTourValidityPeriod,
} from './search-params.js';

type WasteToursToolbarFilterFieldsProps = {
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly draftQuery: string;
  readonly draftStatus: 'all' | WasteTourStatus;
  readonly draftTourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly draftTourReview: WasteManagementSearchParams['tourReview'];
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | WasteTourStatus) => void;
  readonly onDraftTourValidityPeriodChange: (value: WasteManagementTourValidityPeriod) => void;
  readonly onDraftTourReviewChange: (value: WasteManagementSearchParams['tourReview']) => void;
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

export const TourValidityPeriodField = ({
  value,
  onChange,
  referenceYear = Number(toDatetimeLocalValue(new Date().toISOString()).slice(0, 4)),
}: Readonly<{
  value: WasteManagementTourValidityPeriod;
  onChange: (value: WasteManagementTourValidityPeriod) => void;
  referenceYear?: number;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
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
      {(
        [
          [1, 'firstDateFromLabel', draftFirstDateFrom, onDraftFirstDateFromChange],
          [2, 'firstDateToLabel', draftFirstDateTo, onDraftFirstDateToChange],
          [3, 'endDateFromLabel', draftEndDateFrom, onDraftEndDateFromChange],
          [4, 'endDateToLabel', draftEndDateTo, onDraftEndDateToChange],
        ] as const
      ).map(([index, label, value, onChange]) => (
        <WasteToursToolbarFilterField key={index} label={pt(`tours.filters.${label}`)}>
          <DateInput
            id={`waste-tour-filter-date-${index}`}
            aria-label={pt(`tours.filters.${label}`)}
            value={value ?? ''}
            onValueChange={(next) => {
              if (!next || isCalendarDate(next)) onChange(next || undefined);
            }}
            className="h-10 rounded-lg"
          />
        </WasteToursToolbarFilterField>
      ))}
    </>
  );
};

export const WasteToursToolbarFilterFields = (props: WasteToursToolbarFilterFieldsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <WasteToursToolbarBasicFilterFields {...props} />
      <WasteToursToolbarFilterField label={pt('tours.filters.reviewLabel')}>
        <Select
          aria-label={pt('tours.filters.reviewLabel')}
          value={props.draftTourReview ?? ''}
          className="h-10 rounded-lg"
          onChange={(event) => {
            const value = event.target.value;
            props.onDraftTourReviewChange(
              value === 'reviewed' || value === 'unreviewed' ? value : undefined
            );
          }}
        >
          <option value="">{pt('tours.filters.review.all')}</option>
          <option value="unreviewed">{pt('tours.filters.review.unreviewed')}</option>
          <option value="reviewed">{pt('tours.filters.review.reviewed')}</option>
        </Select>
      </WasteToursToolbarFilterField>
      <WasteToursToolbarDateFilterFields {...props} />
    </div>
  );
};
