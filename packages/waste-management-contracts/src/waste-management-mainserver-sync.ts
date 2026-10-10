export type WasteMainserverSyncItem = Readonly<{
  id?: string;
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city?: string;
  note?: string;
  district?: string;
  rhythmRrule?: string;
  rhythmStartDate?: string;
  rhythmExcludes?: readonly string[];
}>;

export type WasteMainserverSyncSnapshot = Readonly<{
  pickupTimes: readonly WasteMainserverSyncItem[];
}>;
