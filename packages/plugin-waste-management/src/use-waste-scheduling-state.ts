import { useState } from 'react';

import type { WasteTourRecord } from '@sva/plugin-sdk';
import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
  type GlobalDateShiftFormState,
  type TourDateShiftFormState,
} from './waste-management.scheduling.shared.js';

export const useWasteSchedulingState = () => {
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
  const [lastOutcome, setLastOutcome] = useState<'create-success' | 'update-success' | null>(null);
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
    lastOutcome,
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
    setLastOutcome,
    setSaving,
  };
};

export type WasteSchedulingState = ReturnType<typeof useWasteSchedulingState>;
