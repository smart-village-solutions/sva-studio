import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormDefaults, wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import { WasteMasterDataFractionCreateContent } from './waste-management.master-data-fraction-create-content.js';
import { WasteMasterDataFractionsContent } from './waste-management.master-data-fractions-content.js';
import { WasteMasterDataLocationFormContent } from './waste-management.master-data-location-form-content.js';
import { WasteMasterDataLocationsWorkspace } from './waste-management.master-data-locations-workspace.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteMasterDataTabContent = ({
  controller,
  search,
  tab,
}: {
  readonly controller: ReturnType<typeof useWasteMasterDataController>;
  readonly search: WasteManagementSearchParams;
  readonly tab: WasteManagementSearchParams['masterDataTab'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const fractionViewSuccess =
    search.fractionsView !== 'list' &&
    controller.message?.kind === 'success' &&
    (controller.message.text === pt('masterData.fractions.messages.createSuccess') ||
      controller.message.text === pt('masterData.fractions.messages.updateSuccess'));
  const locationViewSuccess =
    search.locationsView !== 'list' &&
    controller.message?.kind === 'success' &&
    (controller.message.text === pt('masterData.collectionLocations.messages.createSuccess') ||
      controller.message.text === pt('masterData.collectionLocations.messages.updateSuccess'));

  useEffect(() => {
    if (!fractionViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.resetFractionForm();
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        fractionsView: 'list',
      },
      replace: true,
    });
  }, [controller.resetFractionForm, controller.setDialogOpen, fractionViewSuccess, navigate, search]);

  useEffect(() => {
    if (!locationViewSuccess) {
      return;
    }

    controller.setLocationDialogOpen(false);
    controller.resetLocationForm();
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        locationsView: 'list',
      },
      replace: true,
    });
  }, [controller.resetLocationForm, controller.setLocationDialogOpen, locationViewSuccess, navigate, search]);

  if (tab === 'fractions' && search.fractionsView !== 'list') {
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
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              fractionsView: 'list',
            },
          });
        }}
        onSubmit={controller.onSubmitFraction}
      />
    );
  }

  if (tab === 'fractions') {
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
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              fractionsView: 'create',
            },
          });
        }}
        onOpenEditFraction={(fraction) => {
          controller.setDialogMode('edit');
          controller.setDialogOpen(false);
          controller.setFractionForm(wasteMasterDataFormMappers.fractionToForm(fraction));
          controller.setMessage(null);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              fractionsView: 'edit',
            },
          });
        }}
        onOpenDeleteFraction={(fraction) => controller.deleteFraction(fraction.id)}
        onDeleteFractions={controller.deleteFractions}
        onToggleFractionStatus={controller.setFractionActive}
        onFractionsSortChange={(sortBy, sortDirection) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              fractionsSortBy: sortBy,
              fractionsSortDirection: sortDirection,
            },
          });
        }}
        page={search.page}
        pageSize={search.pageSize}
        onPageChange={(page) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              page,
            },
          });
        }}
        onPageSizeChange={(pageSize) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              page: 1,
              pageSize,
            },
          });
        }}
        saving={controller.saving}
      />
    );
  }

  if (search.locationsView !== 'list') {
    return (
      <WasteMasterDataLocationFormContent
        mode={search.locationsView === 'edit' ? 'edit' : 'create'}
        form={controller.locationForm}
        regions={controller.overview?.regions ?? []}
        cities={controller.overview?.cities ?? []}
        streets={controller.overview?.streets ?? []}
        houseNumbers={controller.overview?.houseNumbers ?? []}
        saving={controller.saving}
        onChange={(patch) => controller.setLocationForm((current) => ({ ...current, ...patch }))}
        onCancel={() => {
          controller.setLocationDialogOpen(false);
          controller.resetLocationForm();
          controller.setMessage(null);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              locationsView: 'list',
            },
          });
        }}
        onSubmit={controller.onSubmitLocation}
      />
    );
  }

  return (
    <WasteMasterDataLocationsWorkspace
      regions={controller.filteredRegions}
      cities={controller.filteredCities}
      streets={controller.filteredStreets}
      houseNumbers={controller.filteredHouseNumbers}
      collectionLocations={controller.filteredCollectionLocations}
      locationTourLinks={controller.overview?.locationTourLinks ?? []}
      selectedLocationIds={controller.selectedLocationIds}
      allFilteredLocationsSelected={controller.allFilteredLocationsSelected}
      selectedCollectionLocationsCount={controller.selectedCollectionLocations.length}
      availableTours={controller.availableTours}
      page={search.page}
      pageSize={search.pageSize}
      selectedTourId={search.tourId}
      onTourFilterChange={(tourId) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            tourId: tourId || undefined,
          },
        });
      }}
      onPageChange={(page) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            page,
          },
        });
      }}
      onPageSizeChange={(pageSize) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            page: 1,
            pageSize,
          },
        });
      }}
      onToggleSelectAll={controller.toggleSelectAllFilteredLocations}
      onToggleLocation={controller.toggleLocationSelection}
      onOpenCreateRegion={controller.openCreateRegionDialog}
      onOpenCreateCity={controller.openCreateCityDialog}
      onOpenCreateStreet={controller.openCreateStreetDialog}
      onOpenCreateHouseNumber={controller.openCreateHouseNumberDialog}
      onOpenCreateLocation={() => {
        controller.setLocationDialogMode('create');
        controller.setLocationDialogOpen(false);
        controller.setLocationForm({
          ...wasteMasterDataFormDefaults.createCollectionLocation(),
          regionId: search.regionId ?? '',
          cityId: search.cityId ?? '',
        });
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            locationsView: 'create',
          },
        });
      }}
      onOpenEditRegion={controller.openEditRegionDialog}
      onOpenEditCity={controller.openEditCityDialog}
      onOpenEditStreet={controller.openEditStreetDialog}
      onOpenEditHouseNumber={controller.openEditHouseNumberDialog}
      onOpenBulkAssignments={controller.openBulkAssignmentsDialog}
      onOpenEditLocation={(location) => {
        controller.setLocationDialogMode('edit');
        controller.setLocationDialogOpen(false);
        controller.setLocationForm(wasteMasterDataFormMappers.collectionLocationToForm(location));
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            locationsView: 'edit',
          },
        });
      }}
      getLocationLabel={controller.getLocationLabel}
    />
  );
};
