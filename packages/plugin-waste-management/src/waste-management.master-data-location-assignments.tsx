import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  WasteFractionRecord,
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { toDatetimeLocalValue, usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import {
  applyAssignmentWrites,
  assignmentWriteStatus,
  getLinkedTourIds,
  readBackAssignments,
  getUnconfirmedChanges,
  type AssignmentAttempt,
  type Draft,
} from './waste-management.master-data-location-assignment-writes.js';
import {
  LocationAssignmentFilters,
  LocationAssignmentTable,
  assignmentKey,
  type AssignmentSort,
  type AssignmentSortField,
} from './waste-management.master-data-location-assignment-table.js';
import type { WasteManagementTourValidityPeriod } from './search-params.js';
import { defaultWastePageSize } from './pagination-search-params.js';
import {
  createPagedItems,
  WastePanelTableBottomBar,
  WastePanelTableTopBar,
} from './waste-management.table-frame.js';
import { sortWasteTours } from './waste-management.tours.content.helpers.js';
import {
  matchesWasteTourValidityPeriod,
  resolveWasteTourValidityYear,
} from './waste-management.tours.validity-filter.js';

const locationCounts = new Map<string, number>();
const createFractionNameMap = (fractions: readonly WasteFractionRecord[]) =>
  new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const));

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
    const refreshed = await readBackAssignments(onReload, locationId, attempt);
    if (!refreshed) {
      setAwaitingReadback(attempt);
      setMessage({ kind: 'warning', text: pt(`${assignmentKey}.messages.readBackUnconfirmed`) });
      return;
    }

    setAwaitingReadback(null);
    const confirmedTourIds = getLinkedTourIds(refreshed);
    for (const id of confirmedTourIds) creationIds.current.delete(id);
    const remaining = getUnconfirmedChanges(attempt.draft, confirmedTourIds);
    setDraft(remaining);
    setMessage(assignmentWriteStatus(pt, attempt, remaining.size));
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

  const actionLabel = saving ? 'saving' : 'save';
  const reloadLabel = saving ? 'reloading' : 'reload';

  return (
    <section className="space-y-4 rounded-lg border border-border-subtle bg-card p-4 sm:p-6">
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

      <StatusNotice message={message} />

      <WastePanelTableTopBar
        actions={
          <Button type="button" disabled={actionDisabled} onClick={() => void handleSave()}>
            {pt(`${assignmentKey}.actions.${awaitingReadback ? reloadLabel : actionLabel}`)}
          </Button>
        }
        activeFilters={
          <>
            {query.trim() ? (
              <span>
                {pt('tours.filters.nameLabel')} · {query.trim()}
              </span>
            ) : null}
            {period !== 'all' ? (
              <span>
                {pt(`tours.filters.validityPeriod.${period}`, {
                  year: resolveWasteTourValidityYear(period, referenceYear),
                })}
              </span>
            ) : null}
          </>
        }
      >
        {tours.length > 0 ? (
          <LocationAssignmentFilters
            query={query}
            period={period}
            referenceYear={referenceYear}
            onQueryChange={setQuery}
            onPeriodChange={setPeriod}
            onFilterChange={() => setPage(1)}
          />
        ) : null}
      </WastePanelTableTopBar>
      {sortedTours.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {pt(`${assignmentKey}.${tours.length === 0 ? 'empty' : 'noMatches'}`)}
        </p>
      ) : (
        <LocationAssignmentTable
          items={pagedTours.items}
          sort={sort}
          changeSort={changeSort}
          fractionNamesById={fractionNamesById}
          pendingChanges={pendingChanges}
          isSelected={isSelected}
          toggleTours={toggleTours}
          sortedTours={sortedTours}
          allFilteredSelected={allFilteredSelected}
          someFilteredSelected={someFilteredSelected}
          selectionDisabled={selectionDisabled}
          footer={
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
          }
        />
      )}
    </section>
  );
};
