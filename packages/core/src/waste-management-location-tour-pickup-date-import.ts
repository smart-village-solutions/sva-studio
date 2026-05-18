export {
  wasteLocationTourPickupDateImportDefaults,
  type WasteLocationTourPickupDateImportEntityPreview,
  type WasteLocationTourPickupDateImportIssue,
  type WasteLocationTourPickupDateImportParseResult,
  type WasteLocationTourPickupDateImportPlan,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
  type WasteLocationTourPickupDateImportPreview,
  type WasteLocationTourPickupDateImportRow,
  type WasteLocationTourPickupDateImportSummary,
  type WasteLocationTourPickupDateImportUpserts,
} from './waste-management-location-tour-pickup-date-import.types.js';
export {
  detectWasteImportCsvDelimiter,
  parseWasteLocationTourPickupDateCsv,
} from './waste-management-location-tour-pickup-date-parser.js';
export { planWasteLocationTourPickupDateImport } from './waste-management-location-tour-pickup-date-planner.js';

export const normalizeWasteImportPickupDate = (value: string): string | null => {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map((entry) => Number(entry));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
};
