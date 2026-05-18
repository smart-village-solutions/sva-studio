import {
  wasteManagementOperationsContract,
  type WasteManagementCsvDelimiter,
  type WasteManagementImportProfileId,
  type WasteManagementImportSourceFormat,
} from './waste-management-operations-contract.js';

export type WasteManagementImportColumnDefinition = {
  readonly key: string;
  readonly required: boolean;
  readonly example?: string;
};

export type WasteManagementImportMappingTemplate = {
  readonly templateId: string;
  readonly displayName: string;
  readonly description: string;
  readonly sourceFormat: WasteManagementImportSourceFormat;
};

export type WasteManagementImportProfileCatalogEntry = {
  readonly profileId: WasteManagementImportProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly sourceFormats: readonly WasteManagementImportSourceFormat[];
  readonly requiredColumns: readonly WasteManagementImportColumnDefinition[];
  readonly optionalColumns: readonly WasteManagementImportColumnDefinition[];
  readonly validationRules: readonly string[];
  readonly mappingTemplates: readonly WasteManagementImportMappingTemplate[];
  readonly templateDelimiter?: WasteManagementCsvDelimiter;
  readonly templateHeaders?: readonly string[];
  readonly templateSampleRows?: readonly (readonly string[])[];
};

const createTemplates = (
  profileId: WasteManagementImportProfileId
): readonly WasteManagementImportMappingTemplate[] => [
  {
    templateId: `${profileId}.canonical-csv-v1`,
    displayName: 'Canonical CSV v1',
    description: 'Uses the shared canonical waste CSV column layout without plugin-local persistence.',
    sourceFormat: 'text/csv',
  },
  {
    templateId: `${profileId}.canonical-xlsx-v1`,
    displayName: 'Canonical XLSX v1',
    description: 'Uses the shared canonical waste XLSX workbook layout without plugin-local persistence.',
    sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
];

const importSourceFormats = [...wasteManagementOperationsContract.importSourceFormats] as const;

const importTemplate = (input: {
  readonly profileId: WasteManagementImportProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly requiredColumns: readonly WasteManagementImportColumnDefinition[];
  readonly optionalColumns: readonly WasteManagementImportColumnDefinition[];
  readonly sourceFormats?: readonly WasteManagementImportSourceFormat[];
  readonly validationRules?: readonly string[];
  readonly templateDelimiter?: WasteManagementCsvDelimiter;
  readonly templateHeaders?: readonly string[];
  readonly templateSampleRows?: readonly (readonly string[])[];
}): WasteManagementImportProfileCatalogEntry => ({
  profileId: input.profileId,
  displayName: input.displayName,
  description: input.description,
  sourceFormats: input.sourceFormats ?? importSourceFormats,
  requiredColumns: input.requiredColumns,
  optionalColumns: input.optionalColumns,
  validationRules:
    input.validationRules ??
    [
      'Header rows must match the canonical column keys exactly.',
      'Required columns must be present on every row.',
      'Referenced ids must be stable across repeated imports.',
    ],
  mappingTemplates: createTemplates(input.profileId),
  templateDelimiter: input.templateDelimiter,
  templateHeaders: input.templateHeaders,
  templateSampleRows: input.templateSampleRows,
});

export const wasteManagementImportCatalog = [
  importTemplate({
    profileId: wasteManagementOperationsContract.importProfileIds.geographyCollectionLocations,
    displayName: 'Geografie und Abholorte',
    description:
      'Importiert Regionen, Orte, Straßen, Hausnummern, Abholorte und die fachliche Zuordnung in einer kanonischen CSV-Struktur.',
    requiredColumns: [
      { key: 'region_id', required: true, example: 'region-nord' },
      { key: 'region_name', required: true, example: 'Nord' },
      { key: 'city_id', required: true, example: 'city-musterstadt' },
      { key: 'city_name', required: true, example: 'Musterstadt' },
      { key: 'location_id', required: true, example: 'loc-001' },
      { key: 'active', required: true, example: 'true' },
    ],
    optionalColumns: [
      { key: 'street_id', required: false, example: 'street-hauptstrasse' },
      { key: 'street_name', required: false, example: 'Hauptstraße' },
      { key: 'house_number_id', required: false, example: 'hn-42' },
      { key: 'house_number_value', required: false, example: '42a' },
    ],
  }),
  importTemplate({
    profileId: wasteManagementOperationsContract.importProfileIds.tours,
    displayName: 'Touren',
    description:
      'Importiert Tourstammdaten, Fraktionszuordnungen und wiederkehrende oder benutzerdefinierte Termine in einer fachnahen CSV-Vorlage.',
    requiredColumns: [
      { key: 'tour_id', required: true, example: 'tour-restmuell-1' },
      { key: 'tour_name', required: true, example: 'Restmüll Nord' },
      { key: 'waste_fraction_ids', required: true, example: 'restmuell|bio' },
      { key: 'active', required: true, example: 'true' },
    ],
    optionalColumns: [
      { key: 'description', required: false, example: 'Standardtour Nord' },
      { key: 'recurrence', required: false, example: 'weekly' },
      { key: 'first_date', required: false, example: '2026-01-10' },
      { key: 'end_date', required: false, example: '2026-12-31' },
      { key: 'custom_dates', required: false, example: '2026-01-10|2026-01-24' },
    ],
  }),
  importTemplate({
    profileId: wasteManagementOperationsContract.importProfileIds.dateShifts,
    displayName: 'Ausweichtermine',
    description:
      'Importiert globale und tourbezogene Verschiebungen über eine gemeinsame CSV-Form mit explizitem Kontextfeld.',
    requiredColumns: [
      { key: 'shift_id', required: true, example: 'shift-2026-osterfeuer' },
      { key: 'shift_context', required: true, example: 'global' },
      { key: 'original_date', required: true, example: '2026-04-03' },
      { key: 'actual_date', required: true, example: '2026-04-04' },
      { key: 'has_year', required: true, example: 'true' },
    ],
    optionalColumns: [
      { key: 'tour_id', required: false, example: 'tour-restmuell-1' },
      { key: 'description', required: false, example: 'Feiertagsverschiebung' },
      { key: 'tour_ids', required: false, example: 'tour-restmuell-1|tour-bio-2' },
    ],
  }),
  importTemplate({
    profileId: wasteManagementOperationsContract.importProfileIds.locationTourPickupDates,
    displayName: 'Tourzuordnungen nach Fraktionen',
    description:
      'Importiert Tourzuordnungen je Adresse aus einer CSV mit Fraktionsspalten und Tourbezeichnungen in den Zellen.',
    sourceFormats: ['text/csv'],
    requiredColumns: [{ key: 'Ort', required: true, example: 'Musterstadt' }],
    optionalColumns: [
      { key: 'Region', required: false, example: 'Nord' },
      { key: 'Straße', required: false, example: 'Hauptstraße' },
      { key: 'Hausnummern', required: false, example: '42a' },
      { key: 'Fraktion...', required: false, example: 'HM.3.3' },
    ],
    validationRules: [
      'A header row is required.',
      'The address block starts with Ort and may optionally contain Region, Straße and Hausnummern in that order.',
      'Each additional column header becomes a waste fraction name.',
      'Each filled fraction cell must contain the name of the assigned waste tour.',
    ],
    templateDelimiter: ';',
    templateHeaders: ['Ort', 'Straße', 'Hausmüll', 'Papier', 'Gelbe Säcke'],
    templateSampleRows: [
      ['Perleberg', 'Ackerstraße', 'HM.3.3', 'PPK.7.2', 'LVP.9.4'],
      ['Bad Wilsnack', '', '', 'PPK.1.1', ''],
    ],
  }),
] as const satisfies readonly WasteManagementImportProfileCatalogEntry[];

export const getWasteManagementImportCatalogEntry = (
  profileId: WasteManagementImportProfileId
): WasteManagementImportProfileCatalogEntry | undefined =>
  wasteManagementImportCatalog.find((entry) => entry.profileId === profileId);
