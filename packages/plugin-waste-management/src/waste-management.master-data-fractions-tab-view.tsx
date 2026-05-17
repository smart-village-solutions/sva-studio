import { useNavigate } from '@tanstack/react-router';

import { WasteMasterDataFractionCreateContent } from './waste-management.master-data-fraction-create-content.js';
import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import { WasteMasterDataFractionsContent } from './waste-management.master-data-fractions-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;

export const WasteMasterDataFractionsTabView = ({
  controller,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  if (search.fractionsView !== 'list') {
    return (
      <WasteMasterDataFractionCreateContent
        mode={search.fractionsView === 'edit' ? 'edit' : 'create'}
        form={controller.fractionForm}
        saving={controller.saving}
        onChange={(patch) => controller.setFractionForm((current) => ({ ...current, ...patch }))}
        onCancel={() => {
          controller.setDialogOpen(false);
          controller.resetFractionForm();
          controller.setMessage(null);
          controller.setLastOutcome(null);
          void navigate({
            to: '/plugins/waste-management',
            search: { ...search, fractionsView: 'list', wasteFractionId: undefined },
          });
        }}
        onSubmit={controller.onSubmitFraction}
      />
    );
  }

  return (
    <WasteMasterDataFractionsContent
      fractions={controller.filteredFractions}
      fractionsSortBy={search.fractionsSortBy}
      fractionsSortDirection={search.fractionsSortDirection}
      onOpenCreateFraction={() => {
        controller.setDialogMode('create');
        controller.setDialogOpen(false);
        controller.resetFractionForm();
        controller.setMessage(null);
        controller.setLastOutcome(null);
        void navigate({
          to: '/plugins/waste-management',
          search: { ...search, fractionsView: 'create', wasteFractionId: undefined },
        });
      }}
      onOpenEditFraction={(fraction) => {
        controller.setDialogMode('edit');
        controller.setDialogOpen(false);
        controller.setFractionForm(wasteMasterDataFormMappers.fractionToForm(fraction));
        controller.setMessage(null);
        controller.setLastOutcome(null);
        void navigate({
          to: '/plugins/waste-management',
          search: { ...search, fractionsView: 'edit', wasteFractionId: fraction.id },
        });
      }}
      onOpenDeleteFraction={(fraction) => controller.deleteFraction(fraction.id)}
      onDeleteFractions={controller.deleteFractions}
      onToggleFractionStatus={controller.setFractionActive}
      onFractionsSortChange={(sortBy, sortDirection) => {
        void navigate({
          to: '/plugins/waste-management',
          search: { ...search, fractionsSortBy: sortBy, fractionsSortDirection: sortDirection },
        });
      }}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={(page) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page } });
      }}
      onPageSizeChange={(pageSize) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } });
      }}
      saving={controller.saving}
    />
  );
};
