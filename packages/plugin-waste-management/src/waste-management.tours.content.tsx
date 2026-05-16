import { useEffect, useMemo, useState } from 'react';
import { IconArrowsSort, IconCalendarMonth, IconEdit, IconFilter, IconListDetails, IconTrash } from '@tabler/icons-react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, Checkbox, Input, Select, StudioConfirmDialog, StudioEmptyState, cn } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { createPagedItems, WastePanelTableBottomBar, WastePanelTableTopBar } from './waste-management.table-frame.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { resolveTourAssignmentItems } from './waste-management.tours.locations.js';
import { formatTourRecurrence } from './waste-management.tours.presentation.js';

const formatDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeZone: 'UTC' }).format(parsed);
};

const resolveTourShiftCount = (tour: WasteTourRecord, schedulingOverview: WasteManagementSchedulingOverview | null) =>
  (schedulingOverview?.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id).length +
  (schedulingOverview?.globalDateShifts ?? []).filter((shift) => !shift.tourIds || shift.tourIds.includes(tour.id)).length;

export const WasteToursEmptyState = ({ onOpenCreateDialog }: { readonly onOpenCreateDialog: () => void }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('tours.messages.emptyTitle')}</p>
        <p>{pt('tours.messages.emptyBody')}</p>
        <div className="pt-2">
          <Button type="button" onClick={onOpenCreateDialog}>
            {pt('tours.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};

export const WasteToursContent = ({
  assignmentContextLoading,
  message,
  tours,
  fractions,
  masterDataOverview,
  schedulingOverview,
  onOpenCreateDialog,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
  onToggleTourStatus,
  onDeleteTour,
  onDeleteTours,
  page,
  pageSize,
  query,
  status,
  onPageChange,
  onPageSizeChange,
  onQueryChange,
  onStatusChange,
}: {
  readonly assignmentContextLoading: boolean;
  readonly message: StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: 'all' | 'active' | 'inactive') => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const pagedTours = useMemo(() => createPagedItems({ items: tours, page, pageSize }), [page, pageSize, tours]);
  const fractionNamesById = useMemo(() => new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const)), [fractions]);
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(query.trim().length > 0 || status !== 'all');
  const [tourPendingDelete, setTourPendingDelete] = useState<WasteTourRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const visibleTourIds = useMemo(() => pagedTours.items.map((tour) => tour.id), [pagedTours.items]);
  const allVisibleSelected = visibleTourIds.length > 0 && visibleTourIds.every((tourId) => selectedTourIds.includes(tourId));
  const someVisibleSelected = visibleTourIds.some((tourId) => selectedTourIds.includes(tourId));

  useEffect(() => {
    const availableIds = new Set(tours.map((tour) => tour.id));
    setSelectedTourIds((current) => current.filter((tourId) => availableIds.has(tourId)));
  }, [tours]);

  useEffect(() => {
    if (query.trim().length > 0 || status !== 'all') {
      setFiltersOpen(true);
    }
  }, [query, status]);

  const toolbar = useMemo(
    () => (
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'h-10 rounded-lg border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
                selectedTourIds.length === 0 && 'text-destructive/50'
              )}
              disabled={selectedTourIds.length === 0}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <IconTrash aria-hidden="true" className="h-4 w-4" />
              {pt('tours.table.deleteSelected')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-border/70 px-3"
              aria-expanded={filtersOpen}
              aria-controls="waste-tours-filters"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <IconFilter aria-hidden="true" className="h-4 w-4" />
              {pt('tours.table.filtersTitle')}
            </Button>
          </div>
          {filtersOpen ? (
            <div
              id="waste-tours-filters"
              className="rounded-lg border border-border/60 bg-muted/[0.08] px-3 py-3"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm">
                  <span className="text-muted-foreground">{pt('tours.table.name')}</span>
                  <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder={pt('tours.table.nameFilterPlaceholder')}
                    className="h-10 rounded-lg"
                  />
                </label>
                <label className="flex min-w-44 flex-col gap-2 text-sm">
                  <span className="text-muted-foreground">{pt('filters.statusLabel')}</span>
                  <Select
                    value={status}
                    className="h-10 rounded-lg"
                    onChange={(event) => onStatusChange(event.target.value as 'all' | 'active' | 'inactive')}
                  >
                    <option value="all">{pt('filters.status.all')}</option>
                    <option value="active">{pt('filters.status.active')}</option>
                    <option value="inactive">{pt('filters.status.inactive')}</option>
                  </Select>
                </label>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onOpenCreateDialog} className="rounded-lg">
            {pt('tours.actions.openCreate')}
          </Button>
        </div>
      </div>
    ),
    [onOpenCreateDialog, onQueryChange, onStatusChange, pt, query, selectedTourIds.length, status]
  );

  const SortLabel = ({ label }: { readonly label: string }) => (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <IconArrowsSort aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );

  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <section className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
        <WastePanelTableTopBar>{toolbar}</WastePanelTableTopBar>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('tours.table.ariaLabel')}>
            <caption className="sr-only">{pt('tours.table.caption')}</caption>
            <thead className="bg-muted/20 text-left text-[13px] text-foreground">
              <tr className="border-b border-border/70">
                <th scope="col" className="w-11 px-3 py-3">
                  <Checkbox
                    aria-label={pt('tours.table.selectAll')}
                    checked={allVisibleSelected}
                    data-indeterminate={someVisibleSelected && !allVisibleSelected ? 'true' : undefined}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelectedTourIds((current) => {
                        if (checked) {
                          return Array.from(new Set([...current, ...visibleTourIds]));
                        }
                        const visibleSet = new Set(visibleTourIds);
                        return current.filter((tourId) => !visibleSet.has(tourId));
                      });
                    }}
                  />
                </th>
                <th scope="col" className="w-[150px] px-3 py-3 font-semibold">
                  <SortLabel label={pt('tours.table.name')} />
                </th>
                <th scope="col" className="w-[176px] px-3 py-3">{pt('tours.table.fractions')}</th>
                <th scope="col" className="w-[132px] px-3 py-3 font-semibold">
                  <SortLabel label={pt('tours.table.recurrence')} />
                </th>
                <th scope="col" className="w-[156px] px-3 py-3">{pt('tours.table.dateRange')}</th>
                <th scope="col" className="w-[168px] px-3 py-3">{pt('tours.table.shifts')}</th>
                <th scope="col" className="w-[94px] px-3 py-3 font-semibold">
                  <SortLabel label={pt('tours.table.locations')} />
                </th>
                <th scope="col" className="w-[92px] px-3 py-3 font-semibold">
                  <SortLabel label={pt('tours.table.status')} />
                </th>
                <th scope="col" className="w-[150px] px-3 py-3 text-right">{pt('tours.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedTours.items.map((tour) => {
                const assignmentItems = resolveTourAssignmentItems(pt, masterDataOverview, tour);
                const recurrenceLabel =
                  formatTourRecurrence(pt, tour.recurrence) === '—'
                    ? pt('tours.table.noRecurrence')
                    : formatTourRecurrence(pt, tour.recurrence);
                const fractionNames = tour.wasteFractionIds
                  .map((fractionId) => fractionNamesById.get(fractionId))
                  .filter((value): value is string => typeof value === 'string' && value.length > 0);
                const shiftCount = resolveTourShiftCount(tour, schedulingOverview);
                const isSelected = selectedTourIds.includes(tour.id);

                return (
                  <tr
                    key={tour.id}
                    className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0"
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        aria-label={pt('tours.table.selectRow', { value: tour.name })}
                        checked={isSelected}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedTourIds((current) =>
                            checked ? (current.includes(tour.id) ? current : [...current, tour.id]) : current.filter((tourId) => tourId !== tour.id)
                          );
                        }}
                      />
                    </td>
                    <td className="w-[150px] px-3 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{tour.name}</p>
                        {tour.description ? <p className="text-sm text-muted-foreground">{tour.description}</p> : null}
                      </div>
                    </td>
                    <td className="w-[176px] px-3 py-3">
                      {fractionNames.length ? (
                        <div className="flex flex-wrap gap-2">
                          {fractionNames.map((fractionName) => (
                            <Badge
                              key={`${tour.id}-${fractionName}`}
                              variant="outline"
                              className="rounded-md border-[#E9E7E1] bg-[#F3F1EC] px-2.5 py-1 text-xs font-medium text-[#6B7C8F]"
                            >
                              {fractionName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="w-[132px] px-3 py-3 text-sm">{recurrenceLabel}</td>
                    <td className="w-[156px] px-3 py-3">
                      <div className="space-y-1 text-sm">
                        {tour.firstDate ? <p>{pt('tours.meta.startDate', { value: formatDisplayDate(tour.firstDate) })}</p> : null}
                        {tour.endDate ? <p>{pt('tours.meta.endDate', { value: formatDisplayDate(tour.endDate) })}</p> : null}
                        {!tour.firstDate && !tour.endDate ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </td>
                    <td className="w-[168px] px-3 py-3">
                      <span className="text-sm text-muted-foreground">
                        {shiftCount > 0 ? pt('tours.meta.shiftCount', { value: shiftCount }) : pt('tours.table.noShifts')}
                      </span>
                    </td>
                    <td className="w-[94px] px-3 py-3">
                      {assignmentContextLoading ? (
                        <span className="text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</span>
                      ) : (
                        <span className="text-sm">{assignmentItems.length}</span>
                      )}
                    </td>
                    <td className="w-[92px] px-3 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tour.active}
                          aria-label={
                            tour.active
                              ? pt('tours.actions.deactivateStatus', { value: tour.name })
                              : pt('tours.actions.activateStatus', { value: tour.name })
                          }
                          disabled={assignmentContextLoading}
                          className={cn(
                            'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            'disabled:cursor-not-allowed disabled:opacity-60',
                            tour.active ? 'bg-primary' : 'bg-muted'
                          )}
                          onClick={() => {
                            void onToggleTourStatus(tour, !tour.active);
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform',
                              tour.active ? 'translate-x-[16px]' : 'translate-x-0.5'
                            )}
                          />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                          aria-label={pt('tours.actions.openCalendar')}
                          onClick={() => onOpenCalendar(tour)}
                        >
                          <IconCalendarMonth aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                          aria-label={pt('tours.actions.openAssignments')}
                          onClick={() => {
                            const firstAssignment = assignmentItems[0];
                            if (firstAssignment) {
                              onOpenEditAssignmentsDialog(tour, firstAssignment.id);
                              return;
                            }
                            onOpenCreateAssignmentsDialog(tour);
                          }}
                        >
                          <IconListDetails aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                          aria-label={pt('tours.actions.edit')}
                          onClick={() => onOpenEditDialog(tour)}
                        >
                          <IconEdit aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
                          aria-label={pt('tours.actions.delete')}
                          onClick={() => setTourPendingDelete(tour)}
                        >
                          <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>
      <StudioConfirmDialog
        open={tourPendingDelete !== null}
        title={pt('tours.deleteDialog.title')}
        description={pt('tours.deleteDialog.description', {
          value: tourPendingDelete?.name ?? '',
        })}
        confirmLabel={pt('tours.deleteDialog.confirm')}
        cancelLabel={pt('tours.deleteDialog.cancel')}
        onCancel={() => setTourPendingDelete(null)}
        onConfirm={() => {
          if (!tourPendingDelete) {
            return;
          }
          void Promise.resolve(onDeleteTour(tourPendingDelete)).finally(() => setTourPendingDelete(null));
        }}
      />
      <StudioConfirmDialog
        open={bulkDeleteOpen}
        title={pt('tours.bulkDeleteDialog.title')}
        description={pt('tours.bulkDeleteDialog.description', {
          value: selectedTourIds.length,
        })}
        confirmLabel={pt('tours.bulkDeleteDialog.confirm')}
        cancelLabel={pt('tours.bulkDeleteDialog.cancel')}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          void Promise.resolve(onDeleteTours(selectedTourIds)).finally(() => {
            setSelectedTourIds([]);
            setBulkDeleteOpen(false);
          });
        }}
      />
    </div>
  );
};
