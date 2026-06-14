import { useState } from 'react';

import type { WasteCustomRecurrencePresetRecord, WasteFractionRecord, WasteTourRecord } from '@sva/plugin-sdk';
import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
} from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
} from './waste-management.tours.shared.js';
import type { LocationTourLinkFormState, TourFormState } from './waste-management.tours.types.js';

export const useWasteToursState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementToursOverview | null>(null);
  const [availableFractions, setAvailableFractions] = useState<readonly WasteFractionRecord[]>([]);
  const [customRecurrencePresets, setCustomRecurrencePresets] = useState<readonly WasteCustomRecurrencePresetRecord[]>([]);
  const [masterDataOverview, setMasterDataOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [assignmentContextLoading, setAssignmentContextLoading] = useState(true);
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
  const [lastOutcome, setLastOutcome] = useState<'create-success' | 'update-success' | null>(null);
  const [saving, setSaving] = useState(false);

  return {
    loading,
    overview,
    availableFractions,
    customRecurrencePresets,
    masterDataOverview,
    assignmentContextLoading,
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
    lastOutcome,
    saving,
    setLoading,
    setOverview,
    setAvailableFractions,
    setCustomRecurrencePresets,
    setMasterDataOverview,
    setAssignmentContextLoading,
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
    setLastOutcome,
    setSaving,
  };
};

export type WasteToursState = ReturnType<typeof useWasteToursState>;
