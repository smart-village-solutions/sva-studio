import type { WasteTourRecord } from '@sva/plugin-sdk';
import { useState } from 'react';

import {
  type CollectionLocationFormState,
  type LocationTourLinkBulkFormState,
  wasteMasterDataFormDefaults,
} from './waste-management.master-data.forms.js';

export const useWasteMasterDataLocationState = () => {
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogMode, setLocationDialogMode] = useState<'create' | 'edit'>('create');
  const [locationForm, setLocationForm] = useState<CollectionLocationFormState>(
    wasteMasterDataFormDefaults.createCollectionLocation()
  );
  const [bulkAssignmentsDialogOpen, setBulkAssignmentsDialogOpen] = useState(false);
  const [bulkAssignmentsForm, setBulkAssignmentsForm] = useState<LocationTourLinkBulkFormState>(
    wasteMasterDataFormDefaults.createBulkAssignments()
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<readonly string[]>([]);
  const [availableTours, setAvailableTours] = useState<readonly WasteTourRecord[]>([]);

  return {
    locationDialogOpen,
    locationDialogMode,
    locationForm,
    bulkAssignmentsDialogOpen,
    bulkAssignmentsForm,
    selectedLocationIds,
    availableTours,
    setLocationDialogOpen,
    setLocationDialogMode,
    setLocationForm,
    setBulkAssignmentsDialogOpen,
    setBulkAssignmentsForm,
    setSelectedLocationIds,
    setAvailableTours,
  };
};
