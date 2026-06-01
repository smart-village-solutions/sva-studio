import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select } from '@sva/studio-ui-react';

type WasteToursToolbarFilterFieldsProps = {
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly draftQuery: string;
  readonly draftStatus: 'all' | 'active' | 'inactive';
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
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
}) => (
  <label className="flex min-w-44 flex-col gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    {children}
  </label>
);

const WasteToursToolbarBasicFilterFields = ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
}: Pick<
  WasteToursToolbarFilterFieldsProps,
  | 'fractions'
  | 'draftQuery'
  | 'draftStatus'
  | 'draftTourWasteFractionId'
  | 'onDraftQueryChange'
  | 'onDraftStatusChange'
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
          onChange={(event) => onDraftStatusChange(event.target.value as 'all' | 'active' | 'inactive')}
        >
          <option value="all">{pt('tours.filters.status.all')}</option>
          <option value="active">{pt('tours.filters.status.active')}</option>
          <option value="inactive">{pt('tours.filters.status.inactive')}</option>
        </Select>
      </WasteToursToolbarFilterField>
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
        <Input
          aria-label={pt('tours.filters.firstDateFromLabel')}
          type="date"
          value={draftFirstDateFrom ?? ''}
          onChange={(event) => onDraftFirstDateFromChange(event.target.value || undefined)}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.firstDateToLabel')}>
        <Input
          aria-label={pt('tours.filters.firstDateToLabel')}
          type="date"
          value={draftFirstDateTo ?? ''}
          onChange={(event) => onDraftFirstDateToChange(event.target.value || undefined)}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.endDateFromLabel')}>
        <Input
          aria-label={pt('tours.filters.endDateFromLabel')}
          type="date"
          value={draftEndDateFrom ?? ''}
          onChange={(event) => onDraftEndDateFromChange(event.target.value || undefined)}
          className="h-10 rounded-lg"
        />
      </WasteToursToolbarFilterField>
      <WasteToursToolbarFilterField label={pt('tours.filters.endDateToLabel')}>
        <Input
          aria-label={pt('tours.filters.endDateToLabel')}
          type="date"
          value={draftEndDateTo ?? ''}
          onChange={(event) => onDraftEndDateToChange(event.target.value || undefined)}
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
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
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
        draftTourWasteFractionId={draftTourWasteFractionId}
        onDraftQueryChange={onDraftQueryChange}
        onDraftStatusChange={onDraftStatusChange}
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
