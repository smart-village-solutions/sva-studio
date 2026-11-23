import { useState } from 'react';
import { isCalendarDate, usePluginTranslation } from '@sva/plugin-sdk';
import { Button, DateInput, Select, StudioField } from '@sva/studio-ui-react';
import { WasteListFilterDialog, WasteListSearch } from './waste-management.list-filter-dialog.js';
import type { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const schedulingFilterDefaults = {
  q: '',
  shiftContext: 'all',
  tourId: undefined,
  shiftDateFrom: undefined,
  shiftDateTo: undefined,
} satisfies Partial<WasteManagementSearchParams>;
export type SchedulingFilters = Pick<
  WasteManagementSearchParams,
  keyof typeof schedulingFilterDefaults
>;

type FilterFieldsProps = {
  readonly draft: SchedulingFilters;
  readonly edit: (patch: Partial<SchedulingFilters>) => void;
};

const SchedulingTourFilter = ({
  draft,
  tours,
  edit,
}: FilterFieldsProps & {
  readonly tours: WasteViewModel['availableTours'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <label className="grid gap-1 text-sm">
      {pt('masterData.locationsWorkspace.filters.tour')}
      <Select
        value={draft.tourId ?? ''}
        onChange={(event) => edit({ tourId: event.currentTarget.value || undefined })}
      >
        <option value="">{pt('masterData.locationsWorkspace.filters.allTours')}</option>
        {draft.tourId && !tours.some((tour) => tour.id === draft.tourId) ? (
          <option value={draft.tourId}>{draft.tourId}</option>
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

const SchedulingShiftFilters = ({
  draft,
  triggerId,
  invalidRange,
  edit,
}: FilterFieldsProps & {
  readonly triggerId: string;
  readonly invalidRange: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <label className="grid gap-1 text-sm">
        {pt('filters.shiftContextLabel')}
        <Select
          value={draft.shiftContext}
          onChange={(event) =>
            edit({
              shiftContext: event.currentTarget.value as SchedulingFilters['shiftContext'],
            })
          }
        >
          {(['all', 'holiday', 'global', 'tour'] as const).map((kind) => (
            <option key={kind} value={kind}>
              {pt(`filters.shiftContext.${kind}`)}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm">{pt('scheduling.table.originalDate')}</legend>
        {(['shiftDateFrom', 'shiftDateTo'] as const).map((field) => {
          const label = pt(field === 'shiftDateFrom' ? 'filters.dateFrom' : 'filters.dateTo');
          return (
            <StudioField key={field} id={`${triggerId}-${field}`} label={label}>
              <DateInput
                id={`${triggerId}-${field}`}
                aria-label={label}
                aria-invalid={invalidRange}
                value={draft[field] ?? ''}
                onValueChange={(value) => {
                  if (!value || isCalendarDate(value)) edit({ [field]: value || undefined });
                }}
              />
            </StudioField>
          );
        })}
      </fieldset>
      {invalidRange ? (
        <p role="alert" className="text-sm text-destructive">
          {pt('filters.invalidRange')}
        </p>
      ) : null}
    </>
  );
};

const toSchedulingFilters = (search: WasteManagementSearchParams): SchedulingFilters => ({
  q: search.q,
  shiftContext: search.shiftContext,
  tourId: search.tourId,
  shiftDateFrom: search.shiftDateFrom,
  shiftDateTo: search.shiftDateTo,
});

export const SchedulingFiltersToolbar = ({
  search,
  tours,
  navigation,
}: {
  readonly search: WasteManagementSearchParams;
  readonly tours: WasteViewModel['availableTours'];
  readonly navigation: ReturnType<typeof useWasteSchedulingListNavigation>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const assignmentsTab = search.tab === 'tourAssignments';
  const triggerId = `waste-${search.tab}-filter-trigger`;
  const [draft, setDraft] = useState<SchedulingFilters | null>(null);
  const [resetQuery, setResetQuery] = useState(false);
  const edit = (patch: Partial<SchedulingFilters>) =>
    setDraft((current) => current && { ...current, ...patch });
  const invalidRange = Boolean(
    draft?.shiftDateFrom && draft.shiftDateTo && draft.shiftDateFrom > draft.shiftDateTo
  );
  return (
    <>
      {!assignmentsTab ? (
        <WasteListSearch
          value={search.q}
          label={pt('filters.searchLabel')}
          onCommit={(q) => navigation.applyFilters({ q })}
        />
      ) : null}
      <Button
        type="button"
        id={triggerId}
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={draft !== null}
        onClick={() => {
          setResetQuery(false);
          setDraft(toSchedulingFilters(search));
        }}
      >
        {pt('filters.open')}
      </Button>
      <WasteListFilterDialog
        id={triggerId}
        title={pt('filters.open')}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        onReset={() => {
          setResetQuery(true);
          setDraft(schedulingFilterDefaults);
        }}
        onApply={() => {
          if (!draft) return;
          const { q, ...filters } = draft;
          navigation.applyFilters(
            assignmentsTab ? { tourId: draft.tourId } : { ...filters, ...(resetQuery ? { q } : {}) }
          );
          setDraft(null);
        }}
        disabled={!assignmentsTab && invalidRange}
      >
        {draft ? (
          <>
            <SchedulingTourFilter draft={draft} tours={tours} edit={edit} />
            {!assignmentsTab ? (
              <SchedulingShiftFilters
                draft={draft}
                triggerId={triggerId}
                edit={edit}
                invalidRange={invalidRange}
              />
            ) : null}
          </>
        ) : null}
      </WasteListFilterDialog>
    </>
  );
};
