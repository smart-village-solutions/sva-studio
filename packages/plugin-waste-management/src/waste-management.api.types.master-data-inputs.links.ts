export type CreateWasteManagementHouseNumberInput = Readonly<{
  id: string;
  number: string;
  streetId: string;
}>;

export type UpdateWasteManagementHouseNumberInput = Readonly<{
  number: string;
  streetId: string;
}>;

export type CreateWasteManagementCollectionLocationInput = Readonly<{
  id: string;
  cityId: string;
  regionId?: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
}>;

export type UpdateWasteManagementCollectionLocationInput = Readonly<{
  cityId: string;
  regionId?: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
}>;

export type CreateWasteManagementLocationTourLinkInput = Readonly<{
  id: string;
  locationId: string;
  tourId: string;
}>;

export type UpdateWasteManagementLocationTourLinkInput = Readonly<{
  locationId: string;
  tourId: string;
}>;

export type CreateWasteManagementLocationTourLinksBulkInput = Readonly<{
  locationIds: readonly string[];
  tourId: string;
}>;
