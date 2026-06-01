import { useNavigate } from '@tanstack/react-router';

import { WasteMasterDataFractionCreateContent } from './waste-management.master-data-fraction-create-content.js';
import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import { WasteMasterDataFractionsContent } from './waste-management.master-data-fractions-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;

const resetFractionsViewState = (controller: WasteMasterDataController) => {
  controller.setDialogOpen(false);
  controller.resetFractionForm();
  controller.setMessage(null);
  controller.setLastOutcome(null);
};

const navigateToFractionsRoute = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  fractionsView: WasteManagementSearchParams['fractionsView'],
  wasteFractionId?: string,
  options?: { readonly replace?: boolean },
) =>
  navigate({
    to: '/plugins/waste-management',
    search: { ...search, fractionsView, wasteFractionId },
    ...(options?.replace ? { replace: true } : {}),
  });

const WasteMasterDataFractionsFormView = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => (
  <WasteMasterDataFractionCreateContent
    mode={search.fractionsView === 'edit' ? 'edit' : 'create'}
    form={controller.fractionForm}
    saving={controller.saving}
    onChange={(patch) => controller.setFractionForm((current) => ({ ...current, ...patch }))}
    onCancel={() => {
      resetFractionsViewState(controller);
      void navigateToFractionsRoute(navigate, search, 'list');
    }}
    onSubmit={controller.onSubmitFraction}
  />
);

const WasteMasterDataFractionsListView = ({
  controller,
  navigate,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly search: WasteManagementSearchParams;
}) => (
  <WasteMasterDataFractionsContent
    fractions={controller.filteredFractions}
    fractionsSortBy={search.fractionsSortBy}
    fractionsSortDirection={search.fractionsSortDirection}
    fractionsStatus={search.fractionsStatus ?? 'all'}
    onOpenCreateFraction={() => {
      controller.setDialogMode('create');
      resetFractionsViewState(controller);
      void navigateToFractionsRoute(navigate, search, 'create');
    }}
    onOpenEditFraction={(fraction) => {
      controller.setDialogMode('edit');
      controller.setDialogOpen(false);
      controller.setFractionForm(wasteMasterDataFormMappers.fractionToForm(fraction));
      controller.setMessage(null);
      controller.setLastOutcome(null);
      void navigateToFractionsRoute(navigate, search, 'edit', fraction.id);
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
    onFractionsStatusChange={(fractionsStatus) => {
      void navigate({
        to: '/plugins/waste-management',
        search: { ...search, fractionsStatus, page: 1 },
      });
    }}
    page={search.page}
    pageSize={search.pageSize}
    onPageChange={(page) => void navigate({ to: '/plugins/waste-management', search: { ...search, page } })}
    onSyncPageChange={(page) =>
      void navigate({ to: '/plugins/waste-management', search: { ...search, page }, replace: true })}
    onPageSizeChange={(pageSize) =>
      void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } })}
    saving={controller.saving}
  />
);

export const WasteMasterDataFractionsTabView = ({
  controller,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  if (search.fractionsView !== 'list') {
    return <WasteMasterDataFractionsFormView controller={controller} navigate={navigate} search={search} />;
  }

  return <WasteMasterDataFractionsListView controller={controller} navigate={navigate} search={search} />;
};
