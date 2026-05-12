import { useState } from 'react';

import {
  type CityFormState,
  type FractionFormState,
  type HouseNumberFormState,
  type RegionFormState,
  type StreetFormState,
  wasteMasterDataFormDefaults,
} from './waste-management.master-data.forms.js';

export const useWasteMasterDataEntityState = () => {
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

  return {
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
  };
};
