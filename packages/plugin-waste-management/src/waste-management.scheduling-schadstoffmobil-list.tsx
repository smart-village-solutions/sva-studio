import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { WasteLocationTourPickupDateRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioConfirmDialog } from '@sva/studio-ui-react';
import { useState } from 'react';

export const WasteSchadstoffmobilAssignmentsList = ({
  entries,
  locationLabels,
  onCreate,
  onEdit,
  onDelete,
}: {
  readonly entries: readonly WasteLocationTourPickupDateRecord[];
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly onCreate: () => void;
  readonly onEdit: (entry: WasteLocationTourPickupDateRecord) => void;
  readonly onDelete: (entry: WasteLocationTourPickupDateRecord) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<WasteLocationTourPickupDateRecord | null>(null);

  const sortedEntries = [...entries].sort((left, right) => {
    const dateCompare = left.pickupDate.localeCompare(right.pickupDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (locationLabels.get(left.locationId) ?? left.locationId).localeCompare(
      locationLabels.get(right.locationId) ?? right.locationId,
      'de',
    );
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('scheduling.schadstoffmobil.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.schadstoffmobil.description')}</p>
      </div>
      <div className="overflow-hidden rounded-none border-y border-border bg-card shadow-shell">
        <div className="flex items-center justify-end border-b border-border/60 px-4 py-3">
          <Button type="button" className="rounded-lg" onClick={onCreate}>
            {pt('scheduling.schadstoffmobil.actions.openCreate')}
          </Button>
        </div>
        {sortedEntries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{pt('scheduling.schadstoffmobil.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse" aria-label={pt('scheduling.schadstoffmobil.table.ariaLabel')}>
              <caption className="sr-only">{pt('scheduling.schadstoffmobil.table.caption')}</caption>
              <thead className="bg-muted/20 text-left text-[13px] text-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="px-3 py-3">{pt('scheduling.schadstoffmobil.table.pickupDate')}</th>
                  <th scope="col" className="px-3 py-3">{pt('scheduling.schadstoffmobil.table.location')}</th>
                  <th scope="col" className="px-3 py-3">{pt('scheduling.schadstoffmobil.table.note')}</th>
                  <th scope="col" className="px-3 py-3 text-right">{pt('scheduling.schadstoffmobil.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0"
                  >
                    <td className="px-3 py-3 text-sm">{entry.pickupDate}</td>
                    <td className="px-3 py-3 text-sm">{locationLabels.get(entry.locationId) ?? entry.locationId}</td>
                    <td className="px-3 py-3 text-sm">{entry.note ?? ''}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                          aria-label={pt('scheduling.schadstoffmobil.actions.edit')}
                          onClick={() => onEdit(entry)}
                        >
                          <IconEdit aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                          aria-label={pt('scheduling.schadstoffmobil.actions.delete')}
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
        title={pt('scheduling.schadstoffmobil.dialog.deleteTitle')}
        description={pt('scheduling.schadstoffmobil.dialog.deleteDescription')}
        confirmLabel={pt('scheduling.schadstoffmobil.actions.confirmDelete')}
        cancelLabel={pt('scheduling.schadstoffmobil.actions.cancel')}
        onCancel={() => setPendingDeleteEntry(null)}
        onConfirm={() => {
          const entry = pendingDeleteEntry;
          setPendingDeleteEntry(null);
          if (entry) {
            void onDelete(entry);
          }
        }}
      />
    </div>
  );
};
