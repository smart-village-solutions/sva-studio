import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from './waste-management-master-data.js';
import type { WasteManagementCsvDelimiter } from './waste-management-operations-contract.js';

const ADDRESS_HEADERS = ['Region', 'Ort', 'Straße', 'Hausnummern'] as const;
const SUPPORTED_DELIMITERS = [';', ',', '\t', '|'] as const satisfies readonly WasteManagementCsvDelimiter[];

export const wasteLocationTourPickupDateImportDefaults = {
  allStreetsName: 'Alle Straßen',
  allHouseNumbersName: 'Alle Hausnummern',
  defaultFractionColor: '#808080',
  addressHeaders: ADDRESS_HEADERS,
  supportedDelimiters: SUPPORTED_DELIMITERS,
} as const;

export type WasteLocationTourPickupDateImportIssue = {
  readonly rowNumber: number;
  readonly column: string;
  readonly message: string;
  readonly value?: string;
};

export type WasteLocationTourPickupDateImportRow = {
  readonly rowNumber: number;
  readonly region?: string;
  readonly city: string;
  readonly street: string;
  readonly houseNumbers: string;
  readonly pickupDate?: string;
  readonly note?: string;
  readonly tourNamesByFractionName: Readonly<Record<string, string>>;
};

export type WasteLocationTourPickupDateImportParseResult = {
  readonly delimiter: WasteManagementCsvDelimiter;
  readonly detectedDelimiter: WasteManagementCsvDelimiter;
  readonly header: readonly string[];
  readonly fractionNames: readonly string[];
  readonly rows: readonly WasteLocationTourPickupDateImportRow[];
  readonly validRowCount: number;
  readonly invalidRowCount: number;
  readonly issues: readonly WasteLocationTourPickupDateImportIssue[];
};

export type WasteLocationTourPickupDateImportEntityPreview = {
  readonly existing: number;
  readonly created: number;
};

export type WasteLocationTourPickupDateImportSummary = Readonly<{
  fractions: WasteLocationTourPickupDateImportEntityPreview;
  regions: WasteLocationTourPickupDateImportEntityPreview;
  cities: WasteLocationTourPickupDateImportEntityPreview;
  streets: WasteLocationTourPickupDateImportEntityPreview;
  houseNumbers: WasteLocationTourPickupDateImportEntityPreview;
  locations: WasteLocationTourPickupDateImportEntityPreview;
  assignments: WasteLocationTourPickupDateImportEntityPreview;
}>;

export type WasteLocationTourPickupDateImportPreview = {
  readonly profileId: 'waste-management.ortsbezogene-tourtermine';
  readonly delimiter: WasteManagementCsvDelimiter;
  readonly detectedDelimiter: WasteManagementCsvDelimiter;
  readonly fractionNames: readonly string[];
  readonly existingFractions: readonly string[];
  readonly newFractions: readonly string[];
  readonly existingTours: readonly string[];
  readonly newTours: readonly string[];
  readonly validRowCount: number;
  readonly invalidRowCount: number;
  readonly errors: readonly WasteLocationTourPickupDateImportIssue[];
  readonly summary: WasteLocationTourPickupDateImportSummary;
};

export type WasteLocationTourPickupDateImportPlanningSnapshot = {
  readonly fractions: readonly WasteFractionRecord[];
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly locations: readonly WasteCollectionLocationRecord[];
  readonly tours: readonly WasteTourRecord[];
  readonly assignments: readonly WasteLocationTourLinkRecord[];
};

export type WasteLocationTourPickupDateImportUpserts = Readonly<{
  fractions: readonly WasteFractionRecord[];
  regions: readonly WasteRegionRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
  houseNumbers: readonly WasteHouseNumberRecord[];
  locations: readonly WasteCollectionLocationRecord[];
  tours: readonly WasteTourRecord[];
  assignments: readonly WasteLocationTourLinkRecord[];
}>;

export type WasteLocationTourPickupDateImportPlan = {
  readonly summary: WasteLocationTourPickupDateImportSummary;
  readonly existingFractions: readonly string[];
  readonly newFractions: readonly string[];
  readonly existingTours: readonly string[];
  readonly newTours: readonly string[];
  readonly upserts: WasteLocationTourPickupDateImportUpserts;
};
