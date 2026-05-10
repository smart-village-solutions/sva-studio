export type CreateWasteManagementRegionInput = Readonly<{
  id: string;
  name: string;
}>;

export type UpdateWasteManagementRegionInput = Readonly<{
  name: string;
}>;

export type CreateWasteManagementCityInput = Readonly<{
  id: string;
  name: string;
  regionId?: string;
}>;

export type UpdateWasteManagementCityInput = Readonly<{
  name: string;
  regionId?: string;
}>;

export type CreateWasteManagementStreetInput = Readonly<{
  id: string;
  name: string;
  cityId: string;
}>;

export type UpdateWasteManagementStreetInput = Readonly<{
  name: string;
  cityId: string;
}>;
