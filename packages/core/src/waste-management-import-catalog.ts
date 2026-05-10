import { wasteManagementOperationsContract, type WasteManagementImportProfileId } from './waste-management-operations-contract.js';

export type WasteManagementImportColumnDefinition = {
  readonly key: string;
  readonly required: boolean;
  readonly example?: string;
};

export type WasteManagementImportMappingTemplate = {
  readonly templateId: string;
  readonly displayName: string;
  readonly description: string;
  readonly sourceFormat: 'text/csv';
};

export type WasteManagementImportProfileCatalogEntry = {
  readonly profileId: WasteManagementImportProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly sourceFormat: 'text/csv';
  readonly requiredColumns: readonly WasteManagementImportColumnDefinition[];
  readonly optionalColumns: readonly WasteManagementImportColumnDefinition[];
  readonly validationRules: readonly string[];
  readonly mappingTemplates: readonly WasteManagementImportMappingTemplate[];
};

const csvTemplate = (input: {
  readonly profileId: WasteManagementImportProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly requiredColumns: readonly WasteManagementImportColumnDefinition[];
  readonly optionalColumns: readonly WasteManagementImportColumnDefinition[];
}): WasteManagementImportProfileCatalogEntry => ({
  profileId: input.profileId,
  displayName: input.displayName,
  description: input.description,
  sourceFormat: 'text/csv',
  requiredColumns: input.requiredColumns,
  optionalColumns: input.optionalColumns,
  validationRules: [
    'CSV header must match the canonical column keys exactly.',
    'Required columns must be present on every row.',
    'Referenced ids must be stable across repeated imports.',
  ],
  mappingTemplates: [
    {
      templateId: `${input.profileId}.canonical-csv-v1`,
      displayName: 'Canonical CSV v1',
      description: 'Uses the shared canonical waste CSV column layout without plugin-local persistence.',
      sourceFormat: 'text/csv',
    },
  ],
});

export const wasteManagementImportCatalog = [
  csvTemplate({
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
  csvTemplate({
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
  csvTemplate({
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
] as const satisfies readonly WasteManagementImportProfileCatalogEntry[];

export const getWasteManagementImportCatalogEntry = (
  profileId: WasteManagementImportProfileId
): WasteManagementImportProfileCatalogEntry | undefined =>
  wasteManagementImportCatalog.find((entry) => entry.profileId === profileId);
