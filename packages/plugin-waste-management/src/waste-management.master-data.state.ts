import type {
  WasteManagementMasterDataOverview,
} from './waste-management.api.js';
import {
  type CityFormState,
  type CollectionLocationFormState,
  type FractionFormState,
  type HouseNumberFormState,
  type LocationTourLinkBulkFormState,
  type RegionFormState,
  type StreetFormState,
  wasteMasterDataFormDefaults,
} from './waste-management.master-data.forms.js';
import { type StatusMessage } from './waste-management.page.support.js';
import type { WasteTourRecord } from '@sva/core';
import { startTransition, useState } from 'react';

export const useWasteMasterDataState = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [fractionForm, setFractionForm] = useState<FractionFormState>(wasteMasterDataFormDefaults.createFraction());
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [regionDialogMode, setRegionDialogMode] = useState<'create' | 'edit'>('create');
  const [regionForm, setRegionForm] = useState<RegionFormState>(wasteMasterDataFormDefaults.createRegion());
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [cityDialogMode, setCityDialogMode] = useState<'create' | 'edit'>('create');
  const [cityForm, setCityForm] = useState<CityFormState>(wasteMasterDataFormDefaults.createCity());
  const [streetDialogOpen, setStreetDialogOpen] = useState(false);
  const [streetDialogMode, setStreetDialogMode] = useState<'create' | 'edit'>('create');
  const [streetForm, setStreetForm] = useState<StreetFormState>(wasteMasterDataFormDefaults.createStreet());
  const [houseNumberDialogOpen, setHouseNumberDialogOpen] = useState(false);
  const [houseNumberDialogMode, setHouseNumberDialogMode] = useState<'create' | 'edit'>('create');
  const [houseNumberForm, setHouseNumberForm] = useState<HouseNumberFormState>(wasteMasterDataFormDefaults.createHouseNumber());
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogMode, setLocationDialogMode] = useState<'create' | 'edit'>('create');
  const [locationForm, setLocationForm] = useState<CollectionLocationFormState>(wasteMasterDataFormDefaults.createCollectionLocation());
  const [bulkAssignmentsDialogOpen, setBulkAssignmentsDialogOpen] = useState(false);
  const [bulkAssignmentsForm, setBulkAssignmentsForm] = useState<LocationTourLinkBulkFormState>(
    wasteMasterDataFormDefaults.createBulkAssignments()
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<readonly string[]>([]);
  const [availableTours, setAvailableTours] = useState<readonly WasteTourRecord[]>([]);

  return {
    loading,
    overview,
    error,
    message,
    saving,
    dialogOpen,
    dialogMode,
    fractionForm,
    regionDialogOpen,
    regionDialogMode,
    regionForm,
    cityDialogOpen,
    cityDialogMode,
    cityForm,
    streetDialogOpen,
    streetDialogMode,
    streetForm,
    houseNumberDialogOpen,
    houseNumberDialogMode,
    houseNumberForm,
    locationDialogOpen,
    locationDialogMode,
    locationForm,
    bulkAssignmentsDialogOpen,
    bulkAssignmentsForm,
    selectedLocationIds,
    availableTours,
    setLoading,
    setOverview,
    setError,
    setMessage,
    setSaving,
    setDialogOpen,
    setDialogMode,
    setFractionForm,
    setRegionDialogOpen,
    setRegionDialogMode,
    setRegionForm,
    setCityDialogOpen,
    setCityDialogMode,
    setCityForm,
    setStreetDialogOpen,
    setStreetDialogMode,
    setStreetForm,
    setHouseNumberDialogOpen,
    setHouseNumberDialogMode,
    setHouseNumberForm,
    setLocationDialogOpen,
    setLocationDialogMode,
    setLocationForm,
    setBulkAssignmentsDialogOpen,
    setBulkAssignmentsForm,
    setSelectedLocationIds,
    setAvailableTours,
  };
};

export type WasteMasterDataState = ReturnType<typeof useWasteMasterDataState>;

export const applySuccess = (closeDialog: () => void, setMessage: (message: StatusMessage | null) => void, text: string) => {
  startTransition(() => {
    closeDialog();
    setMessage({ kind: 'success', text });
  });
};
