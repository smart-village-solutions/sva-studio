import type { WasteTourAssignmentRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioConfirmDialog } from '@sva/studio-ui-react';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

export const WasteTourExplicitAssignmentsList = ({
  entries,
  tourLabels,
  locationLabels,
  onCreate,
  onEdit,
  onDelete,
}: {
  readonly entries: readonly WasteTourAssignmentRecord[];
  readonly tourLabels: ReadonlyMap<string, string>;
  readonly locationLabels: ReadonlyMap<string, string>;
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
        tourLabels.get(right.tourId) ?? right.tourId ?? ''
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
          <div className="overflow-x-auto">
            <table
              className="min-w-full border-collapse"
              aria-label={pt('scheduling.assignments.table.ariaLabel')}
            >
              <caption className="sr-only">{pt('scheduling.assignments.table.caption')}</caption>
              <thead className="bg-muted/20 text-left text-[13px]">
                <tr className="border-b border-border/70">
                  <th scope="col" className="px-3 py-3">
                    {pt('scheduling.assignments.table.pickupDate')}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {pt('scheduling.assignments.table.tour')}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {pt('scheduling.assignments.table.locations')}
                  </th>
                  <th scope="col" className="px-3 py-3">
                    {pt('scheduling.assignments.table.note')}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    {pt('scheduling.assignments.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/60 align-top text-[14px] last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-3">{entry.pickupDate}</td>
                    <td className="px-3 py-3">{tourLabels.get(entry.tourId) ?? entry.tourId}</td>
                    <td className="px-3 py-3">
                      <ul>
                        {entry.locationIds.map((id) => (
                          <li key={id}>{locationLabels.get(id) ?? id}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3">{entry.note ?? ''}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0"
                          aria-label={pt('scheduling.assignments.actions.edit')}
                          onClick={() => onEdit(entry)}
                        >
                          <IconEdit aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0"
                          aria-label={pt('scheduling.assignments.actions.delete')}
                          onClick={() => setPendingDeleteEntry(entry)}
                        >
                          <IconTrash aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <StudioConfirmDialog
        open={pendingDeleteEntry !== null}
        title={pt('scheduling.assignments.dialog.deleteTitle')}
        description={pt('scheduling.assignments.dialog.deleteDescription')}
        confirmLabel={pt('scheduling.assignments.actions.confirmDelete')}
        cancelLabel={pt('scheduling.assignments.actions.cancel')}
        onCancel={() => setPendingDeleteEntry(null)}
        onConfirm={() => {
          const entry = pendingDeleteEntry;
          setPendingDeleteEntry(null);
          if (entry) void onDelete(entry);
        }}
      />
    </section>
  );
};
