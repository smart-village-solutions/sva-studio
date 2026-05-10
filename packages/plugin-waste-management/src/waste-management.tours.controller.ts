import type { WasteLocationTourLinkRecord, WasteTourRecord } from '@sva/core';
import { startTransition, useEffect, useState, type FormEvent } from 'react';

import {
  createWasteManagementLocationTourLink,
  createWasteManagementTour,
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementToursOverview,
  updateWasteManagementLocationTourLink,
  updateWasteManagementTour,
  type WasteManagementMasterDataOverview,
  type WasteManagementSchedulingOverview,
  type WasteManagementToursOverview,
} from './waste-management.api.js';
import { resolveApiErrorCode, type StatusMessage } from './waste-management.page.support.js';
import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  filterTours,
  mapLocationTourLinkToForm,
  mapTourToForm,
  resolveTourLocationOptions,
  toCreateLocationTourLinkInput,
  toCreateTourInput,
  toUpdateLocationTourLinkInput,
  toUpdateTourInput,
  type LocationTourLinkFormState,
  type TourFormState,
} from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToursController = (pt: Translate, search: WasteManagementSearchParams) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementToursOverview | null>(null);
  const [availableFractions, setAvailableFractions] = useState<readonly import('@sva/core').WasteFractionRecord[]>([]);
  const [masterDataOverview, setMasterDataOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [schedulingOverview, setSchedulingOverview] = useState<WasteManagementSchedulingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [tourForm, setTourForm] = useState<TourFormState>(createDefaultTourForm());
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [assignmentsDialogMode, setAssignmentsDialogMode] = useState<'create' | 'edit'>('create');
  const [linkForm, setLinkForm] = useState<LocationTourLinkFormState>(createDefaultLocationTourLinkForm());
  const [selectedTour, setSelectedTour] = useState<WasteTourRecord | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOverview = async (active = true) => {
    try {
      const [toursResponse, masterDataResponse, schedulingResponse] = await Promise.all([
        getWasteManagementToursOverview(),
        getWasteManagementMasterDataOverview(),
        getWasteManagementSchedulingOverview(),
      ]);
      if (!active) {
        return;
      }
      setOverview(toursResponse);
      setAvailableFractions(masterDataResponse.fractions);
      setMasterDataOverview(masterDataResponse);
      setSchedulingOverview(schedulingResponse);
      setError(null);
    } catch (loadError) {
      if (!active) {
        return;
      }
      const code = resolveApiErrorCode(loadError);
      setError(code === 'forbidden' ? pt('tours.messages.loadForbidden') : pt('tours.messages.loadError'));
    } finally {
      if (active) {
        setLoading(false);
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

  const openCreateDialog = () => {
    setDialogMode('create');
    setTourForm(createDefaultTourForm());
    setMessage(null);
    setDialogOpen(true);
  };

  const openEditDialog = (tour: WasteTourRecord) => {
    setDialogMode('edit');
    setTourForm(mapTourToForm(tour));
    setMessage(null);
    setDialogOpen(true);
  };

  const openCreateAssignmentsDialog = (tour: WasteTourRecord) => {
    setSelectedTour(tour);
    setAssignmentsDialogMode('create');
    setLinkForm({ ...createDefaultLocationTourLinkForm(), tourId: tour.id });
    setMessage(null);
    setAssignmentsDialogOpen(true);
  };

  const openEditAssignmentsDialog = (tour: WasteTourRecord, linkId: string) => {
    const link = (masterDataOverview?.locationTourLinks ?? []).find((entry) => entry.id === linkId);
    if (!link) {
      return;
    }
    setSelectedTour(tour);
    setAssignmentsDialogMode('edit');
    setLinkForm(mapLocationTourLinkToForm(link));
    setMessage(null);
    setAssignmentsDialogOpen(true);
  };

  const openCalendar = (tour: WasteTourRecord) => {
    setSelectedTour(tour);
    setCalendarOpen(true);
  };

  const onSubmitTour = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (dialogMode === 'create') {
        await createWasteManagementTour(toCreateTourInput(tourForm));
      } else {
        await updateWasteManagementTour(tourForm.id, toUpdateTourInput(tourForm));
      }
      await loadOverview(true);
      startTransition(() => {
        setDialogOpen(false);
        setMessage({
          kind: 'success',
          text: dialogMode === 'create' ? pt('tours.messages.createSuccess') : pt('tours.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('tours.messages.saveForbidden') : pt('tours.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitAssignments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (assignmentsDialogMode === 'create') {
        await createWasteManagementLocationTourLink(toCreateLocationTourLinkInput(linkForm));
      } else {
        await updateWasteManagementLocationTourLink(linkForm.id, toUpdateLocationTourLinkInput(linkForm));
      }
      await loadOverview(true);
      startTransition(() => {
        setAssignmentsDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            assignmentsDialogMode === 'create'
              ? pt('tours.assignments.messages.createSuccess')
              : pt('tours.assignments.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.assignments.messages.saveForbidden')
            : pt('tours.assignments.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    error,
    dialogOpen,
    dialogMode,
    tourForm,
    availableFractions,
    assignmentsDialogOpen,
    assignmentsDialogMode,
    linkForm,
    selectedTour,
    calendarOpen,
    message,
    saving,
    overview,
    masterDataOverview,
    schedulingOverview,
    tours: filterTours(overview?.tours ?? [], search),
    locationOptions: resolveTourLocationOptions(pt, masterDataOverview),
    setDialogOpen,
    setTourForm,
    setAssignmentsDialogOpen,
    setLinkForm,
    setCalendarOpen,
    openCreateDialog,
    openEditDialog,
    openCreateAssignmentsDialog,
    openEditAssignmentsDialog,
    openCalendar,
    onSubmitTour,
    onSubmitAssignments,
    resetTourForm: () => setTourForm(createDefaultTourForm()),
    resetLinkForm: () => setLinkForm(createDefaultLocationTourLinkForm()),
  };
};
