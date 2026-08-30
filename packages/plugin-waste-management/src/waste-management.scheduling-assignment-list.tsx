import type { WasteTourAssignmentRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';
import {
  toWasteCollectionLocationEditSearch,
  toWasteTourEditSearch,
} from './waste-management.cross-link.navigation.js';
import { WasteTourAssignmentDeleteDialog } from './waste-management.scheduling-assignment-delete-dialog.js';

type Translate = ReturnType<typeof usePluginTranslation>;

const AssignmentActions = ({
  entry,
  pt,
  onEdit,
  onDeleteRequest,
}: Readonly<{
  entry: WasteTourAssignmentRecord;
  pt: Translate;
  onEdit: (entry: WasteTourAssignmentRecord) => void;
  onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}>) => (
  <div className="flex justify-end gap-1">
    <Button
      type="button"
      variant="tertiary"
      size="sm"
      className="h-8 w-8 px-0"
      aria-label={pt('scheduling.assignments.actions.edit')}
      tooltip={pt('scheduling.assignments.actions.edit')}
      onClick={() => onEdit(entry)}
    >
      <IconEdit aria-hidden="true" className="h-4 w-4" />
    </Button>
    <Button
      type="button"
      variant="tertiary"
      size="sm"
      className="h-8 w-8 px-0"
      aria-label={pt('scheduling.assignments.actions.delete')}
      tooltip={pt('scheduling.assignments.actions.delete')}
      onClick={() => onDeleteRequest(entry)}
    >
      <IconTrash aria-hidden="true" className="h-4 w-4" />
    </Button>
  </div>
);

const AssignmentRow = ({
  entry,
  tourLabels,
  locationLabels,
  pt,
  search,
  onEdit,
  onDeleteRequest,
}: {
  readonly entry: WasteTourAssignmentRecord;
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly pt: Translate;
  readonly search?: WasteManagementSearchParams;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}) => (
  <tr className="border-b border-border/60 align-top text-[14px] last:border-b-0 hover:bg-muted/20">
    <td className="px-3 py-3">{entry.pickupDate}</td>
    <td className="px-3 py-3">
      {search ? (
        <Link
          to="/plugins/waste-management"
          search={toWasteTourEditSearch(search, entry.tourId)}
          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tourLabels.get(entry.tourId) ?? entry.tourId}
        </Link>
      ) : (
        (tourLabels.get(entry.tourId) ?? entry.tourId)
      )}
    </td>
    <td className="px-3 py-3">
      <ul>
        {entry.locationIds.map((id) => (
          <li key={id}>
            {search ? (
              <Link
                to="/plugins/waste-management"
                search={toWasteCollectionLocationEditSearch(search, id)}
                className="text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {locationLabels.get(id) ?? id}
              </Link>
            ) : (
              (locationLabels.get(id) ?? id)
            )}
          </li>
        ))}
      </ul>
    </td>
    <td className="px-3 py-3">{entry.note ?? ''}</td>
    <td className="px-3 py-3">
      <AssignmentActions entry={entry} pt={pt} onEdit={onEdit} onDeleteRequest={onDeleteRequest} />
    </td>
  </tr>
);

const WasteTourAssignmentsTable = ({
  entries,
  tourLabels,
  locationLabels,
  pt,
  search,
  onEdit,
  onDeleteRequest,
}: {
  readonly entries: readonly WasteTourAssignmentRecord[];
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly pt: Translate;
  readonly search?: WasteManagementSearchParams;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDeleteRequest: (entry: WasteTourAssignmentRecord) => void;
}) => (
  <div className="overflow-x-auto">
    <table
      className="min-w-full border-collapse"
      aria-label={pt('scheduling.assignments.table.ariaLabel')}
    >
      <caption className="sr-only">{pt('scheduling.assignments.table.caption')}</caption>
      <thead className="bg-muted/20 text-left text-[13px]">
        <tr className="border-b border-border/70">
          {(['pickupDate', 'tour', 'locations', 'note', 'actions'] as const).map((column) => (
            <th
              key={column}
              scope="col"
              className={`px-3 py-3${column === 'actions' ? ' text-right' : ''}`}
            >
              {pt(`scheduling.assignments.table.${column}`)}
            </th>
          ))}
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
            onEdit={onEdit}
            onDeleteRequest={onDeleteRequest}
          />
        ))}
      </tbody>
    </table>
  </div>
);

export const WasteTourExplicitAssignmentsList = ({
  entries,
  tourLabels,
  locationLabels,
  search,
  onCreate,
  onEdit,
  onDelete,
}: {
  readonly entries: readonly WasteTourAssignmentRecord[];
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly search?: WasteManagementSearchParams;
  readonly onCreate: () => void;
  readonly onEdit: (entry: WasteTourAssignmentRecord) => void;
  readonly onDelete: (entry: WasteTourAssignmentRecord) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<WasteTourAssignmentRecord | null>(
    null
  );
  const sortedEntries = [...entries].sort(
    (left, right) =>
      left.pickupDate.localeCompare(right.pickupDate) ||
      (tourLabels.get(left.tourId) ?? left.tourId ?? '').localeCompare(
        tourLabels.get(right.tourId) ?? right.tourId ?? '',
        'de'
      )
  );
  return (
    <section className="space-y-3" aria-labelledby="waste-tour-assignments-heading">
      <div className="space-y-1">
        <h3 id="waste-tour-assignments-heading" className="text-sm font-semibold">
          {pt('scheduling.assignments.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.assignments.description')}</p>
      </div>
      <div className="overflow-hidden rounded-none border-y border-border bg-card shadow-shell">
        <div className="flex items-center justify-end border-b border-border/60 px-4 py-3">
          <Button type="button" className="rounded-lg" onClick={onCreate}>
            {pt('scheduling.assignments.actions.openCreate')}
          </Button>
        </div>
        {sortedEntries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {pt('scheduling.assignments.empty')}
          </p>
        ) : (
          <WasteTourAssignmentsTable
            entries={sortedEntries}
            tourLabels={tourLabels}
            locationLabels={locationLabels}
            search={search}
            pt={pt}
            onEdit={onEdit}
            onDeleteRequest={setPendingDeleteEntry}
          />
        )}
      </div>
      <WasteTourAssignmentDeleteDialog
        entry={pendingDeleteEntry}
        onCancel={() => setPendingDeleteEntry(null)}
        onDelete={onDelete}
      />
    </section>
  );
};
