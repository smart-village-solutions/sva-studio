import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { toDatetimeLocalValue, usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import {
  createWasteManagementLocationTourLink,
  deleteWasteManagementLocationTourLink,
} from './waste-management.api.js';
import {
  StatusNotice,
  resolveApiErrorCode,
  type StatusMessage,
} from './waste-management.page.support.js';
import {
  formatTourDateRange,
  formatTourRecurrence,
} from './waste-management.tours.presentation.js';
import { WasteToursRowFractionCell } from './waste-management.tours.table-row.parts.js';
import type { WasteManagementTourValidityPeriod } from './search-params.js';
import { defaultWastePageSize } from './pagination-search-params.js';
import { createPagedItems, WastePanelTableBottomBar } from './waste-management.table-frame.js';
import { sortWasteTours } from './waste-management.tours.content.helpers.js';
import {
  WasteTableSortButton,
  type WasteToursSortDirection,
} from './waste-management.tours.table.parts.js';
import { TourValidityPeriodField } from './waste-management.tours.toolbar.filter-fields.js';
import { matchesWasteTourValidityPeriod } from './waste-management.tours.validity-filter.js';

type AssignmentSortField = 'name' | 'recurrence';
type AssignmentSort = Readonly<{ field: AssignmentSortField; direction: WasteToursSortDirection }>;
const locationCounts = new Map<string, number>();

const createFractionNameMap = (fractions: readonly WasteFractionRecord[]) =>
  new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const));

const assignmentKey = 'masterData.collectionLocations.assignmentEditor';
type Draft = ReadonlyMap<string, boolean>;
type WriteReceipt = Readonly<{ id: string; exists: boolean }>;
type AssignmentAttempt = Readonly<{
  draft: Draft;
  receipts: readonly WriteReceipt[];
  forbidden: boolean;
}>;

const getLinkedTourIds = (links: readonly WasteLocationTourLinkRecord[]) =>
  new Set(links.map((link) => link.tourId));

const getUnconfirmedChanges = (draft: Draft, linkedTourIds: ReadonlySet<string>): Draft => {
  const pending = new Map(
    [...draft].filter(([tourId, selected]) => selected !== linkedTourIds.has(tourId))
  );
  return pending.size === draft.size ? draft : pending;
};

const applyAssignmentWrites = async (
  locationId: string,
  links: readonly WasteLocationTourLinkRecord[],
  draft: Draft,
  creationIds: Map<string, string>
): Promise<AssignmentAttempt> => {
  const results = await Promise.allSettled([
    ...[...draft]
      .filter(([, selected]) => selected)
      .map(async ([tourId]) => {
        const id = creationIds.get(tourId) ?? crypto.randomUUID();
        creationIds.set(tourId, id);
        const link = await createWasteManagementLocationTourLink({ id, locationId, tourId });
        return { id: link.id, exists: true };
      }),
    ...links
      .filter((link) => draft.get(link.tourId) === false)
      .map(async ({ id }) => {
        await deleteWasteManagementLocationTourLink(id);
        return { id, exists: false };
      }),
  ]);
  return {
    draft,
    receipts: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    forbidden: results.some(
      (result) => result.status === 'rejected' && resolveApiErrorCode(result.reason) === 'forbidden'
    ),
  };
};

type LocationAssignmentsProps = {
  readonly locationId: string;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
  readonly disabled?: boolean;
  readonly onReload: (locationId: string) => Promise<readonly WasteLocationTourLinkRecord[] | null>;
};

export const LocationAssignmentsSection = (props: LocationAssignmentsProps) => (
  <LocationAssignmentsEditor key={props.locationId} {...props} />
);

const LocationAssignmentsEditor = ({
  locationId,
  tours,
  fractions,
  links,
  disabled = false,
  onReload,
}: LocationAssignmentsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<Draft>(() => new Map());
  const [awaitingReadback, setAwaitingReadback] = useState<AssignmentAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<WasteManagementTourValidityPeriod>('all');
  const [sort, setSort] = useState<AssignmentSort | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(defaultWastePageSize);
  const searchId = useId();
  const pendingRequest = useRef(false);
  const creationIds = useRef(new Map<string, string>());
  const linkedTourIds = useMemo(() => getLinkedTourIds(links), [links]);

  useEffect(() => {
    setDraft((current) => getUnconfirmedChanges(current, linkedTourIds));
  }, [linkedTourIds]);

  const referenceYear = Number(toDatetimeLocalValue(new Date().toISOString()).slice(0, 4));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sortedTours = useMemo(
    () =>
      sortWasteTours({
        tours: tours.filter(
          (tour) =>
            tour.name.toLocaleLowerCase().includes(normalizedQuery) &&
            matchesWasteTourValidityPeriod(tour, period, referenceYear)
        ),
        sortField: sort?.field ?? 'name',
        sortDirection: sort?.direction ?? 'asc',
        locationCountByTourId: locationCounts,
        pt,
      }),
    [normalizedQuery, period, pt, referenceYear, sort, tours]
  );
  const fractionNamesById = useMemo(() => createFractionNameMap(fractions), [fractions]);
  const pendingChanges = getUnconfirmedChanges(draft, linkedTourIds);
  const isSelected = (tourId: string) => pendingChanges.get(tourId) ?? linkedTourIds.has(tourId);
  const selectedTours = sortedTours.filter(({ id }) => isSelected(id));
  const orderedTours = sort
    ? sortedTours
    : [...selectedTours, ...sortedTours.filter(({ id }) => !isSelected(id))];
  const pagedTours = createPagedItems({ items: orderedTours, page, pageSize });
  const allFilteredSelected = sortedTours.length > 0 && selectedTours.length === sortedTours.length;
  const someFilteredSelected = selectedTours.length > 0;
  const selectionDisabled = disabled || saving || awaitingReadback !== null;
  const actionDisabled = disabled || saving || (!awaitingReadback && pendingChanges.size === 0);

  const changeSort = (field: AssignmentSortField) => {
    setSort((current) => ({
      field,
      direction: current?.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const toggleTours = (tourIds: readonly string[], checked: boolean) => {
    setMessage(null);
    setDraft((current) => {
      const next = new Map(current);
      for (const id of tourIds) {
        if (checked === linkedTourIds.has(id)) next.delete(id);
        else next.set(id, checked);
      }
      return next;
    });
  };

  const verifyAssignmentWrites = async (attempt: AssignmentAttempt) => {
    const refreshed = await onReload(locationId).catch(() => null);
    const observedIds = new Set(refreshed?.map((link) => link.id));
    if (!refreshed || attempt.receipts.some(({ id, exists }) => observedIds.has(id) !== exists)) {
      setAwaitingReadback(attempt);
      setMessage({ kind: 'warning', text: pt(`${assignmentKey}.messages.readBackUnconfirmed`) });
      return;
    }

    setAwaitingReadback(null);
    const confirmedTourIds = getLinkedTourIds(refreshed);
    for (const id of confirmedTourIds) creationIds.current.delete(id);
    const remaining = getUnconfirmedChanges(attempt.draft, confirmedTourIds);
    setDraft(remaining);
    if (remaining.size === 0) {
      setMessage({ kind: 'success', text: pt(`${assignmentKey}.messages.saveSuccess`) });
    } else if (remaining.size < attempt.draft.size) {
      setMessage({
        kind: 'warning',
        text: pt(`${assignmentKey}.messages.savePartial`, { value: String(remaining.size) }),
      });
    } else {
      setMessage({
        kind: 'error',
        text: pt(`${assignmentKey}.messages.${attempt.forbidden ? 'saveForbidden' : 'saveError'}`),
      });
    }
  };

  const handleSave = async () => {
    if (actionDisabled || pendingRequest.current) return;
    pendingRequest.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const attempt =
        awaitingReadback ??
        (await applyAssignmentWrites(locationId, links, pendingChanges, creationIds.current));
      await verifyAssignmentWrites(attempt);
    } finally {
      pendingRequest.current = false;
      setSaving(false);
    }
  };

  const actionLabel = saving
    ? awaitingReadback
      ? 'reloading'
      : 'saving'
    : awaitingReadback
      ? 'reload'
      : 'save';
  const ariaSort = sort?.direction === 'desc' ? 'descending' : 'ascending';

  return (
    <section className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.title')}
          </p>
          <p className="text-sm text-muted-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.description')}
          </p>
          <p className="text-xs text-muted-foreground">
            {pt('masterData.collectionLocations.assignmentEditor.meta.selectedCount', {
              value: String(linkedTourIds.size),
            })}
          </p>
        </div>
        <Button type="button" disabled={actionDisabled} onClick={() => void handleSave()}>
          {pt(`${assignmentKey}.actions.${actionLabel}`)}
        </Button>
      </div>

      <StatusNotice message={message} />

      {tours.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <StudioField id={searchId} label={pt('tours.filters.nameLabel')}>
            <Input
              id={searchId}
              type="search"
              placeholder={pt('tours.filters.namePlaceholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setPage(1);
              }}
            />
          </StudioField>
          <TourValidityPeriodField
            referenceYear={referenceYear}
            value={period}
            onChange={(value) => {
              setPeriod(value);
              setPage(1);
            }}
          />
        </div>
      ) : null}
      {sortedTours.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {pt(`${assignmentKey}.${tours.length === 0 ? 'empty' : 'noMatches'}`)}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-background/70">
          <div
            role="group"
            aria-label={pt(`${assignmentKey}.title`)}
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <table
              className="min-w-full border-collapse"
              aria-label={pt('masterData.collectionLocations.assignmentEditor.title')}
            >
              <thead className="bg-surface-inset text-left text-[13px] text-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="w-11 px-3 py-3">
                    <Checkbox
                      aria-label={pt(`${assignmentKey}.actions.selectAllFiltered`)}
                      checked={allFilteredSelected}
                      indeterminate={someFilteredSelected && !allFilteredSelected}
                      disabled={selectionDisabled}
                      onChange={(event) =>
                        toggleTours(
                          sortedTours.map((tour) => tour.id),
                          event.currentTarget.checked
                        )
                      }
                    />
                  </th>
                  {(['name', 'fractions', 'recurrence'] as const).map((field) => (
                    <th
                      key={field}
                      scope="col"
                      className="w-[220px] px-3 py-3 font-semibold"
                      aria-sort={sort?.field === field ? ariaSort : undefined}
                    >
                      {field === 'fractions' ? (
                        pt('tours.table.fractions')
                      ) : (
                        <WasteTableSortButton
                          label={pt(`tours.table.${field}`)}
                          active={sort?.field === field}
                          direction={sort?.direction ?? 'asc'}
                          onClick={() => changeSort(field)}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTours.items.map((tour) => {
                  const period = formatTourDateRange(pt, tour);
                  const periodId = period ? `waste-location-tour-period-${tour.id}` : undefined;
                  const fractionNames = (tour.wasteFractionIds ?? [])
                    .map((fractionId: string) => fractionNamesById.get(fractionId))
                    .filter((value: string | undefined): value is string => Boolean(value));

                  return (
                    <tr
                      key={tour.id}
                      className="border-b border-border/50 align-top last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          aria-label={pt('tours.table.selectRow', { value: tour.name })}
                          aria-describedby={periodId}
                          checked={isSelected(tour.id)}
                          disabled={selectionDisabled}
                          onChange={(event) => toggleTours([tour.id], event.currentTarget.checked)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">{tour.name}</p>
                        {periodId ? (
                          <p id={periodId} className="text-xs text-muted-foreground">
                            {period}
                          </p>
                        ) : null}
                        {pendingChanges.has(tour.id) ? (
                          <p className="text-xs text-muted-foreground">
                            {pt(
                              `${assignmentKey}.meta.${isSelected(tour.id) ? 'additionPending' : 'removalPending'}`
                            )}
                          </p>
                        ) : null}
                      </td>
                      <WasteToursRowFractionCell tourId={tour.id} fractionNames={fractionNames} />
                      <td className="px-3 py-3 text-sm text-foreground">
                        {formatTourRecurrence(
                          pt,
                          tour.recurrence,
                          tour.customRecurrenceName,
                          tour.customRecurrenceIntervalDays
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <WastePanelTableBottomBar
            pt={pt}
            page={pagedTours.safePage}
            pageSize={pageSize}
            pageCount={pagedTours.pageCount}
            totalItems={pagedTours.totalItems}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </div>
      )}
    </section>
  );
};
