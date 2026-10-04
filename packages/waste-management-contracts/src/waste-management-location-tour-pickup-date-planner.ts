import type {
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

  for (const row of input.rows) {
    applyRowToPlan(state, row);
  }

  return {
    summary: toReadonlySummary(state.summary),
    existingFractions: sortNames(state.existingFractions),
    newFractions: sortNames(state.newFractions),
    existingTours: sortNames(state.existingTours),
    newTours: sortNames(state.newTours),
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
