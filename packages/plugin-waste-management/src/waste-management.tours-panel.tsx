import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import { WasteToursDialogs } from './waste-management.tours-dialogs-panel.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteToursController(pt, search);

  if (controller.loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteToursDialogs controller={controller} />;

  if (!controller.tours.length) {
    return (
      <>
        <WasteToursEmptyState onOpenCreateDialog={controller.openCreateDialog} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteToursContent
        assignmentContextLoading={controller.assignmentContextLoading}
        message={controller.message}
        tours={controller.tours}
        masterDataOverview={controller.masterDataOverview}
        onOpenCreateDialog={controller.openCreateDialog}
        onOpenEditDialog={controller.openEditDialog}
        onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
        onOpenCalendar={controller.openCalendar}
      />
      {dialogs}
    </>
  );
};
