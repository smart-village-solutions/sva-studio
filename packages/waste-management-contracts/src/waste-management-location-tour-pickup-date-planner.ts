import type {
  WasteLocationTourPickupDateImportIssue,
  WasteLocationTourPickupDateImportPlan,
  WasteLocationTourPickupDateImportPlanningSnapshot,
  WasteLocationTourPickupDateImportRow,
  WasteLocationTourPickupDateImportSummary,
} from './waste-management-location-tour-pickup-date-import.types.js';
import type { PlannerState } from './waste-management-location-tour-pickup-date-planner.state.js';
import {
  createState,
  createRuntimeUuid,
} from './waste-management-location-tour-pickup-date-planner.state.js';
import { applyRowToPlan } from './waste-management-location-tour-pickup-date-planner.tours.js';

const toReadonlySummary = (
  summary: PlannerState['summary']
): WasteLocationTourPickupDateImportSummary => summary;

const sortNames = (values: Set<string>): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right, 'de'));

export const planWasteLocationTourPickupDateImport = (
  snapshot: WasteLocationTourPickupDateImportPlanningSnapshot,
  input: { readonly rows: readonly WasteLocationTourPickupDateImportRow[] },
  options?: { readonly createId?: () => string }
): WasteLocationTourPickupDateImportPlan => {
  const state = createState(snapshot, options?.createId ?? createRuntimeUuid);
  const resolvedPickupDates: WasteLocationTourPickupDateImportPlan['resolvedPickupDates'][number][] =
    [];
  const issues: WasteLocationTourPickupDateImportIssue[] = [];

  for (const row of input.rows) {
    try {
      const resolved = applyRowToPlan(state, row);
      if (row.pickupDate !== undefined) {
        resolvedPickupDates.push({ row, ...resolved });
      }
    } catch (error) {
      if (
        row.pickupDate === undefined ||
        !(error instanceof Error) ||
        !error.message.startsWith('ambiguous_regionless_city_match:')
      ) {
        throw error;
      }
      issues.push({
        rowNumber: row.rowNumber,
        column: 'Region',
        message: 'Der Ort ist mehrdeutig. Geben Sie die passende Region an.',
      });
    }
  }

  return {
    summary: toReadonlySummary(state.summary),
    existingFractions: sortNames(state.existingFractions),
    newFractions: sortNames(state.newFractions),
    existingTours: sortNames(state.existingTours),
    newTours: sortNames(state.newTours),
    resolvedPickupDates,
    issues,
    upserts: {
      fractions: [...state.upserts.fractions.values()],
      regions: [...state.upserts.regions.values()],
      cities: [...state.upserts.cities.values()],
      streets: [...state.upserts.streets.values()],
      houseNumbers: [...state.upserts.houseNumbers.values()],
      locations: [...state.upserts.locations.values()],
      tours: [...state.upserts.tours.values()],
      assignments: [...state.upserts.assignments.values()],
    },
  };
};
