import type { WasteTourRecord, WasteTourValidityBulkUpdateInput } from '@sva/plugin-sdk';

import { WasteToursValidityDialog } from './waste-management.tours-validity-dialog.js';

export const WasteToursBulkValidityDialog = ({
  open,
  tours,
  selectedTourIds,
  saving,
  onOpenChange,
  onUpdate,
  onUpdated,
}: Readonly<{
  open: boolean;
  tours: readonly WasteTourRecord[];
  selectedTourIds: readonly string[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (input: WasteTourValidityBulkUpdateInput) => Promise<boolean>;
  onUpdated: () => void;
}>) =>
  open ? (
    <WasteToursValidityDialog
      open
      tours={tours.filter((tour) => selectedTourIds.includes(tour.id))}
      saving={saving}
      onOpenChange={onOpenChange}
      onSubmit={async (input) => {
        const succeeded = await onUpdate(input);
        if (succeeded) onUpdated();
        return succeeded;
      }}
    />
  ) : null;
