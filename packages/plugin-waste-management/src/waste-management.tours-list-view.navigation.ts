import type { WasteTourRecord } from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';

import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteToursController } from './waste-management.tours.controller.js';
import { createDefaultTourForm, mapTourToForm } from './waste-management.tours.shared.js';

type WasteToursController = ReturnType<typeof useWasteToursController>;

export const toCreateTourSearch = (search: WasteManagementSearchParams): WasteManagementSearchParams => ({
  ...search,
  toursView: 'create',
  tourId: undefined,
});

export const toEditTourSearch = (
  search: WasteManagementSearchParams,
  tourId: string,
): WasteManagementSearchParams => ({
  ...search,
  toursView: 'edit',
  tourId,
});

export const toToursPageSearch = (
  search: WasteManagementSearchParams,
  page: number,
): WasteManagementSearchParams => ({
  ...search,
  page,
});

export const toToursPageSizeSearch = (
  search: WasteManagementSearchParams,
  pageSize: number,
): WasteManagementSearchParams => ({
  ...search,
  page: 1,
  pageSize,
});

export const toToursQuerySearch = (
  search: WasteManagementSearchParams,
  q: string,
): WasteManagementSearchParams => ({
  ...search,
  q,
  page: 1,
});

export const toToursStatusSearch = (
  search: WasteManagementSearchParams,
  status: WasteManagementSearchParams['status'],
): WasteManagementSearchParams => ({
  ...search,
  status,
  page: 1,
});

const resetToursFormState = (controller: WasteToursController) => {
  controller.setMessage(null);
  controller.setLastOutcome(null);
};

export const useWasteToursListNavigation = (
  controller: WasteToursController,
  search: WasteManagementSearchParams,
) => {
  const navigate = useNavigate();

  return {
    openCreate: () => {
      controller.setDialogMode('create');
      resetToursFormState(controller);
      controller.setTourForm(createDefaultTourForm());
      void navigate({ to: '/plugins/waste-management', search: toCreateTourSearch(search) });
    },
    openEdit: (tour: WasteTourRecord) => {
      controller.setDialogMode('edit');
      resetToursFormState(controller);
      controller.setTourForm(mapTourToForm(tour));
      void navigate({ to: '/plugins/waste-management', search: toEditTourSearch(search, tour.id) });
    },
    setPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: toToursPageSearch(search, page) });
    },
    setPageSize: (pageSize: number) => {
      void navigate({ to: '/plugins/waste-management', search: toToursPageSizeSearch(search, pageSize) });
    },
    setQuery: (q: string) => {
      void navigate({ to: '/plugins/waste-management', search: toToursQuerySearch(search, q) });
    },
    setStatus: (status: WasteManagementSearchParams['status']) => {
      void navigate({ to: '/plugins/waste-management', search: toToursStatusSearch(search, status) });
    },
  };
};
