import type { WasteTourAssignmentRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { useState } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourAssignmentDeleteDialog } from './waste-management.scheduling-assignment-delete-dialog.js';
import { AssignmentRow } from './waste-management.scheduling-assignment-list.row.js';
import {
  WasteCompactListSort,
  WastePanelTableTopBar,
  type WastePanelTableTopBarProps,
} from './waste-management.table-frame.js';

import { WasteTableSortButton } from './waste-management.tours.table.parts.js';

const assignmentColumns = ['pickupDate', 'tour', 'locations', 'note'] as const;
type AssignmentSort = {
  readonly field: (typeof assignmentColumns)[number];
  readonly direction: 'asc' | 'desc';
};

type Translate = ReturnType<typeof usePluginTranslation>;

const WasteTourAssignmentsTable = ({
  entries,
  sort,
  onSort,
  tourLabels,
  locationLabels,
  pt,
  search,
  canManage,
  onEdit,
  onDeleteRequest,
}: {
  readonly sort: AssignmentSort;
  readonly onSort: (field: AssignmentSort['field']) => void;
  readonly entries: readonly WasteTourAssignmentRecord[];
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly pt: Translate;
  readonly search?: WasteManagementSearchParams;
  readonly canManage: boolean;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}) => (
  <div className="overflow-x-auto">
    <table
      className="min-w-full border-collapse"
      aria-label={pt('scheduling.assignments.table.ariaLabel')}
    >
      <caption className="sr-only">{pt('scheduling.assignments.table.caption')}</caption>
      <thead className="bg-surface-inset text-left text-[13px]">
        <tr className="border-b border-border/70">
          {assignmentColumns.map((column) => (
            <th
              key={column}
              scope="col"
              className="px-3 py-3"
              aria-sort={
                sort.field === column
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
              title={column === 'locations' ? pt('filters.sortByFirstLocation') : undefined}
            >
              <WasteTableSortButton
                label={pt(`scheduling.assignments.table.${column}`)}
                direction={sort.direction}
                active={sort.field === column}
                onClick={() => onSort(column)}
              />
            </th>
          ))}
          {canManage ? (
            <th scope="col" className="px-3 py-3 text-right">
              {pt('scheduling.assignments.table.actions')}
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AssignmentRow
            key={entry.id}
            entry={entry}
            tourLabels={tourLabels}
            locationLabels={locationLabels}
            pt={pt}
            search={search}
            canManage={canManage}
            onEdit={onEdit}
            onDeleteRequest={onDeleteRequest}
          />
        ))}
      </tbody>
    </table>
  </div>
);

const sortAssignments = (
  entries: readonly WasteTourAssignmentRecord[],
  sort: AssignmentSort,
  tourLabels: ReadonlyMap<string, string>,
  locationLabels: ReadonlyMap<string, string>
) => {
  const tourName = (entry: WasteTourAssignmentRecord) =>
    tourLabels.get(entry.tourId) ?? entry.tourId;
  const sortValue = (entry: WasteTourAssignmentRecord) => {
    switch (sort.field) {
      case 'pickupDate':
        return entry.pickupDate;
      case 'tour':
        return tourName(entry);
      case 'locations': {
        const first = entry.locationIds[0];
        return first ? (locationLabels.get(first) ?? first) : undefined;
      }
      case 'note':
        return entry.note;
    }
  };
  return [...entries].sort((left, right) => {
    const a = sortValue(left);
    const b = sortValue(right);
    if (Boolean(a) !== Boolean(b)) return a ? -1 : 1;
    const order = (a ?? '').localeCompare(b ?? '', 'de', { numeric: true, sensitivity: 'base' });
    return (
      (sort.direction === 'asc' ? order : -order) ||
      tourName(left).localeCompare(tourName(right), 'de') ||
      left.id.localeCompare(right.id)
    );
  });
};

const assignmentSortLabel = (pt: Translate, field: AssignmentSort['field']) =>
  pt(
    field === 'locations' ? 'filters.sortByFirstLocation' : `scheduling.assignments.table.${field}`
  );

const AssignmentListToolbar = ({
  toolbar,
  canManage,
  onCreate,
  pt,
}: {
  readonly toolbar?: WastePanelTableTopBarProps;
  readonly canManage: boolean;
  readonly onCreate: () => void;
  readonly pt: Translate;
}) =>
  toolbar || canManage ? (
    <WastePanelTableTopBar
      {...toolbar}
      actions={
        <>
          {toolbar?.actions}
          {canManage ? (
            <Button type="button" className="rounded-md" onClick={onCreate}>
              {pt('scheduling.assignments.actions.openCreate')}
            </Button>
          ) : null}
        </>
      }
    />
  ) : null;

export const WasteTourExplicitAssignmentsList = ({
  entries,
  tourLabels,
  locationLabels,
  search,
  canManage,
  toolbar,
  onCreate,
  onEdit,
  onDelete,
}: {
  readonly entries: readonly WasteTourAssignmentRecord[];
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly search?: WasteManagementSearchParams;
  readonly canManage: boolean;
  readonly toolbar?: WastePanelTableTopBarProps;
  readonly onCreate: () => void;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDelete: (entry: WasteTourAssignmentRecord) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<WasteTourAssignmentRecord | null>(
    null
  );
  const [sort, setSort] = useState<AssignmentSort>({ field: 'pickupDate', direction: 'asc' });
  const sortedEntries = sortAssignments(entries, sort, tourLabels, locationLabels);
  return (
    <section aria-label={pt('scheduling.assignments.title')}>
      <div className="overflow-hidden rounded-none border border-border-subtle bg-card">
        <AssignmentListToolbar
          toolbar={toolbar}
          canManage={canManage}
          onCreate={onCreate}
          pt={pt}
        />
        <WasteCompactListSort
          fields={assignmentColumns}
          field={sort.field}
          direction={sort.direction}
          labelForField={(field) => assignmentSortLabel(pt, field)}
          onChange={(field, direction) => setSort({ field, direction })}
        />
        {sortedEntries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {pt('scheduling.assignments.empty')}
          </p>
        ) : (
          <WasteTourAssignmentsTable
            entries={sortedEntries}
            sort={sort}
            onSort={(field) =>
              setSort({
                field,
                direction: field === sort.field && sort.direction === 'asc' ? 'desc' : 'asc',
              })
            }
            tourLabels={tourLabels}
            locationLabels={locationLabels}
            search={search}
            canManage={canManage}
            pt={pt}
            onEdit={onEdit}
            onDeleteRequest={setPendingDeleteEntry}
          />
        )}
      </div>
      <WasteTourAssignmentDeleteDialog
        entry={canManage ? pendingDeleteEntry : null}
        onCancel={() => setPendingDeleteEntry(null)}
        onDelete={onDelete}
      />
    </section>
  );
};
