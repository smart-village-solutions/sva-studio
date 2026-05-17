import { useNavigate } from '@tanstack/react-router';

import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursFormContent } from './waste-management.tours-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteToursController = ReturnType<typeof useWasteToursController>;

export const WasteToursFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteToursController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  return (
    <WasteToursFormContent
      mode={search.toursView === 'edit' ? 'edit' : 'create'}
      form={controller.tourForm}
      fractions={controller.availableFractions}
      saving={controller.saving}
      onChange={(patch) => controller.setTourForm((current) => ({ ...current, ...patch }))}
      onCancel={() => {
        controller.setDialogOpen(false);
        controller.resetTourForm();
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, toursView: 'list', tourId: undefined } });
      }}
      onSubmit={(event) => controller.onSubmitTour(event, search.toursView === 'edit' ? 'edit' : 'create')}
    />
  );
};
