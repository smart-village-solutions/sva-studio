import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord, WasteTourRecord } from '@sva/core';
import { startTransition, useEffect, useState, type FormEvent } from 'react';

import {
  createWasteManagementGlobalDateShift,
  createWasteManagementTourDateShift,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
  updateWasteManagementGlobalDateShift,
  updateWasteManagementTourDateShift,
  type WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode, type StatusMessage } from './waste-management.page.support.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  filterGlobalDateShifts,
  filterTourDateShifts,
  mapGlobalDateShiftToForm,
  mapTourDateShiftToForm,
  toCreateGlobalDateShiftInput,
  toCreateTourDateShiftInput,
  toUpdateGlobalDateShiftInput,
  toUpdateTourDateShiftInput,
  type GlobalDateShiftFormState,
  type TourDateShiftFormState,
} from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const useWasteSchedulingState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementSchedulingOverview | null>(null);
  const [availableTours, setAvailableTours] = useState<readonly WasteTourRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [tourShiftForm, setTourShiftForm] = useState<TourDateShiftFormState>(createDefaultTourDateShiftForm());
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  const [globalDialogMode, setGlobalDialogMode] = useState<'create' | 'edit'>('create');
  const [globalShiftForm, setGlobalShiftForm] = useState<GlobalDateShiftFormState>(createDefaultGlobalDateShiftForm());
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);

  return {
    loading,
    overview,
    availableTours,
    error,
    dialogOpen,
    dialogMode,
    tourShiftForm,
    globalDialogOpen,
    globalDialogMode,
    globalShiftForm,
    message,
    saving,
    setLoading,
    setOverview,
    setAvailableTours,
    setError,
    setDialogOpen,
    setDialogMode,
    setTourShiftForm,
    setGlobalDialogOpen,
    setGlobalDialogMode,
    setGlobalShiftForm,
    setMessage,
    setSaving,
  };
};

export const useWasteSchedulingController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteSchedulingState();

  const loadOverview = async (active = true) => {
    try {
      const [schedulingResponse, toursResponse] = await Promise.all([
        getWasteManagementSchedulingOverview(),
        getWasteManagementToursOverview(),
      ]);
      if (!active) {
        return;
      }
      state.setOverview(schedulingResponse);
      state.setAvailableTours(toursResponse.tours);
      state.setError(null);
    } catch (loadError) {
      if (!active) {
        return;
      }
      const code = resolveApiErrorCode(loadError);
      state.setError(code === 'forbidden' ? pt('scheduling.messages.loadForbidden') : pt('scheduling.messages.loadError'));
    } finally {
      if (active) {
        state.setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    void loadOverview(active);
    return () => {
      active = false;
    };
  }, [pt]);

  const openCreateTourShiftDialog = () => {
    state.setDialogMode('create');
    state.setTourShiftForm({
      ...createDefaultTourDateShiftForm(),
      tourId: state.availableTours.length === 1 ? state.availableTours[0]?.id ?? '' : '',
    });
    state.setMessage(null);
    state.setDialogOpen(true);
  };

  const openEditTourShiftDialog = (shift: WasteTourDateShiftRecord) => {
    state.setDialogMode('edit');
    state.setTourShiftForm(mapTourDateShiftToForm(shift));
    state.setMessage(null);
    state.setDialogOpen(true);
  };

  const openCreateGlobalShiftDialog = () => {
    state.setGlobalDialogMode('create');
    state.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
    state.setMessage(null);
    state.setGlobalDialogOpen(true);
  };

  const openEditGlobalShiftDialog = (shift: WasteGlobalDateShiftRecord) => {
    state.setGlobalDialogMode('edit');
    state.setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
    state.setMessage(null);
    state.setGlobalDialogOpen(true);
  };

  const onSubmitTourShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.dialogMode === 'create') {
        await createWasteManagementTourDateShift(toCreateTourDateShiftInput(state.tourShiftForm));
      } else {
        await updateWasteManagementTourDateShift(state.tourShiftForm.id, toUpdateTourDateShiftInput(state.tourShiftForm));
      }
      await loadOverview(true);
      startTransition(() => {
        state.setDialogOpen(false);
        state.setMessage({
          kind: 'success',
          text: state.dialogMode === 'create' ? pt('scheduling.tour.messages.createSuccess') : pt('scheduling.tour.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('scheduling.tour.messages.saveForbidden') : pt('scheduling.tour.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  };

  const onSubmitGlobalShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    try {
      if (state.globalDialogMode === 'create') {
        await createWasteManagementGlobalDateShift(toCreateGlobalDateShiftInput(state.globalShiftForm));
      } else {
        await updateWasteManagementGlobalDateShift(state.globalShiftForm.id, toUpdateGlobalDateShiftInput(state.globalShiftForm));
      }
      await loadOverview(true);
      startTransition(() => {
        state.setGlobalDialogOpen(false);
        state.setMessage({
          kind: 'success',
          text: state.globalDialogMode === 'create' ? pt('scheduling.global.messages.createSuccess') : pt('scheduling.global.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('scheduling.global.messages.saveForbidden') : pt('scheduling.global.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  };

  return {
    ...state,
    tourDateShifts: filterTourDateShifts(state.overview?.tourDateShifts ?? [], search),
    globalDateShifts: filterGlobalDateShifts(state.overview?.globalDateShifts ?? [], search),
    openCreateTourShiftDialog,
    openEditTourShiftDialog,
    openCreateGlobalShiftDialog,
    openEditGlobalShiftDialog,
    onSubmitTourShift,
    onSubmitGlobalShift,
    resetTourShiftForm: () => state.setTourShiftForm(createDefaultTourDateShiftForm()),
    resetGlobalShiftForm: () => state.setGlobalShiftForm(createDefaultGlobalDateShiftForm()),
  };
};
