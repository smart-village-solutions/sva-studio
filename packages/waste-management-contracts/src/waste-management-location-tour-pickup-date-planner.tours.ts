import type { WasteFractionRecord, WasteTourRecord } from './waste-management-master-data.js';
import type { WasteLocationTourPickupDateImportRow } from './waste-management-location-tour-pickup-date-import.types.js';
import { wasteLocationTourPickupDateImportDefaults } from './waste-management-location-tour-pickup-date-import.types.js';
import type { PlannerState } from './waste-management-location-tour-pickup-date-planner.state.js';
import {
  normalizeKeyPart,
  registerCreatedRecord,
  shouldCountAsExisting,
  markExistingUsage,
} from './waste-management-location-tour-pickup-date-planner.state.js';
import {
  ensureRegion,
  ensureCity,
  ensureStreet,
  ensureHouseNumber,
  ensureLocation,
} from './waste-management-location-tour-pickup-date-planner.places.js';

const ensureFraction = (state: PlannerState, fractionName: string): WasteFractionRecord => {
  const fractionKey = normalizeKeyPart(fractionName);
  const existingFraction = state.fractionByKey.get(fractionKey);
  if (existingFraction) {
    if (shouldCountAsExisting(state.upserts.fractions, existingFraction.id)) {
      markExistingUsage(
        state.summary.fractions,
        existingFraction.id,
        state.touchedExisting.fractions
      );
      state.existingFractions.add(existingFraction.name);
    }
    return existingFraction;
  }

  const fraction = registerCreatedRecord(state.upserts.fractions, {
    id: state.createId(),
    name: fractionName,
    translations: undefined,
    containerSize: undefined,
    color: wasteLocationTourPickupDateImportDefaults.defaultFractionColor,
    description: undefined,
    active: true,
    reminderConfig: {
      reminderCount: 'none',
      channels: {
        push: false,
        email: false,
        calendar: false,
      },
    },
    createdAt: '',
    updatedAt: '',
  });
  state.fractionByKey.set(fractionKey, fraction);
  state.newFractions.add(fractionName);
  state.summary.fractions.created += 1;
  return fraction;
};

const ensureTour = (state: PlannerState, tourName: string, fractionId: string): WasteTourRecord => {
  const tourKey = normalizeKeyPart(tourName);
  const existingTour = state.tourByName.get(tourKey);
  if (!existingTour) {
    const tour = registerCreatedRecord(state.upserts.tours, {
      id: state.createId(),
      name: tourName,
      description: undefined,
      wasteFractionIds: [fractionId],
      recurrence: null,
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      status: 'draft',
      locationCount: undefined,
      createdAt: '',
      updatedAt: '',
    });
    state.tourByName.set(tourKey, tour);
    state.newTours.add(tourName);
    return tour;
  }

  if (!state.newTours.has(existingTour.name) && !state.touchedExisting.tours.has(existingTour.id)) {
    state.touchedExisting.tours.add(existingTour.id);
    state.existingTours.add(existingTour.name);
  }

  if (existingTour.wasteFractionIds.includes(fractionId)) {
    return existingTour;
  }

  const nextTour = {
    ...existingTour,
    wasteFractionIds: [...existingTour.wasteFractionIds, fractionId],
  };
  state.tourByName.set(tourKey, nextTour);
  state.upserts.tours.set(nextTour.id, nextTour);
  return nextTour;
};

const ensureAssignment = (state: PlannerState, locationId: string, tourId: string): void => {
  const assignmentKey = `${locationId}::${tourId}`;
  if (state.assignmentKeys.has(assignmentKey)) {
    markExistingUsage(state.summary.assignments, assignmentKey, state.touchedExisting.assignments);
    return;
  }

  state.assignmentKeys.add(assignmentKey);
  registerCreatedRecord(state.upserts.assignments, {
    id: state.createId(),
    locationId,
    tourId,
    createdAt: '',
    updatedAt: '',
  });
  state.summary.assignments.created += 1;
};

export const applyRowToPlan = (
  state: PlannerState,
  row: WasteLocationTourPickupDateImportRow
): void => {
  const regionId = ensureRegion(state, row.region);
  const city = ensureCity(state, regionId, row.city);
  const street = ensureStreet(state, city.id, row.street);
  const houseNumber = ensureHouseNumber(state, street.id, row.houseNumbers);
  const location = ensureLocation(state, {
    regionId: regionId ?? city.regionId,
    cityId: city.id,
    streetId: street.id,
    houseNumberId: houseNumber.id,
  });

  for (const [fractionName, tourName] of Object.entries(row.tourNamesByFractionName)) {
    const fraction = ensureFraction(state, fractionName);
    const tour = ensureTour(state, tourName, fraction.id);
    ensureAssignment(state, location.id, tour.id);
  }
};
