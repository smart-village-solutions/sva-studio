import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, StudioEmptyState } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteToursCard } from './waste-management.tours-card.js';

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
  message,
  tours,
  masterDataOverview,
  onOpenCreateDialog,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
}: {
  readonly message: StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onOpenCreateDialog}>
          {pt('tours.actions.openCreate')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('tours.meta.count', { value: tours.length })}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {tours.map((tour) => (
          <WasteToursCard
            key={tour.id}
            tour={tour}
            masterDataOverview={masterDataOverview}
            onOpenEditDialog={onOpenEditDialog}
            onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
            onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
            onOpenCalendar={onOpenCalendar}
          />
        ))}
      </div>
    </div>
  );
};
