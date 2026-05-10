import type { WasteFractionRecord, WasteTourRecord } from '@sva/core';
import { useState } from 'react';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
} from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  type LocationTourLinkFormState,
  type TourFormState,
} from './waste-management.tours.shared.js';

export const useWasteToursState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementToursOverview | null>(null);
  const [availableFractions, setAvailableFractions] = useState<readonly WasteFractionRecord[]>([]);
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

  return {
    loading,
    overview,
    availableFractions,
    masterDataOverview,
    schedulingOverview,
    error,
    dialogOpen,
    dialogMode,
    tourForm,
    assignmentsDialogOpen,
    assignmentsDialogMode,
    linkForm,
    selectedTour,
    calendarOpen,
    message,
    saving,
    setLoading,
    setOverview,
    setAvailableFractions,
    setMasterDataOverview,
    setSchedulingOverview,
    setError,
    setDialogOpen,
    setDialogMode,
    setTourForm,
    setAssignmentsDialogOpen,
    setAssignmentsDialogMode,
    setLinkForm,
    setSelectedTour,
    setCalendarOpen,
    setMessage,
    setSaving,
  };
};

export type WasteToursState = ReturnType<typeof useWasteToursState>;
