import {
  wasteManagementMasterDataContract,
  wasteTourStatuses,
  type WasteLocationTourPickupDateImportPlan,
} from '@sva/waste-management-contracts';

import type {
  ImportedLocationTourPickupDateRecord,
  WasteRepository,
} from './waste-management-operations.import.plan.js';
import {
  normalizeOptionalText,
  parseBoolean,
  parseCustomDates,
  parseDelimitedStringArray,
  parseFollowUpMode,
  parseReasonType,
  parseRecurrence,
} from './waste-management-operations.shared.js';

type GenericImportRow = Record<string, string>;

export const persistLocationTourPickupDateImportPlan = async (
  repository: WasteRepository,
  plan: WasteLocationTourPickupDateImportPlan,
  importedPickupDates: readonly ImportedLocationTourPickupDateRecord[]
) => {
  const assignmentGroups = new Map<string, ImportedLocationTourPickupDateRecord[]>();
  for (const pickupDate of importedPickupDates) {
    const assignmentId = pickupDate.assignmentId ?? pickupDate.id;
    const group = assignmentGroups.get(assignmentId) ?? [];
    group.push(pickupDate);
    assignmentGroups.set(assignmentId, group);
  }
  // Validate every group before the first write so malformed imports cannot be partially persisted.
  const assignments = [...assignmentGroups.entries()].map(([assignmentId, entries]) => {
    const first = entries[0];
    if (!first) throw new Error(`empty_tour_assignment_group:${assignmentId}`);
    if (
      !entries.every(
        (entry) =>
          entry.tourId === first.tourId &&
          entry.pickupDate === first.pickupDate &&
          entry.note === first.note
      )
    ) {
      throw new Error(`inconsistent_tour_assignment_group:${assignmentId}`);
    }
    return {
      id: assignmentId,
      tourId: first.tourId,
      pickupDate: first.pickupDate,
      note: first.note,
      locationIds: [...new Set(entries.map((entry) => entry.locationId))],
    };
  });

  const persistStage = async <T>(
    items: readonly T[],
    persistItem: (item: T) => Promise<void>
  ): Promise<void> => {
    for (const item of items) {
      await persistItem(item);
    }
  };

  await persistStage(plan.upserts.regions, async (region) => {
    await repository.upsertWasteRegion({ id: region.id, name: region.name });
  });
  await persistStage(plan.upserts.cities, async (city) => {
    await repository.upsertWasteCity({ id: city.id, name: city.name, regionId: city.regionId });
  });
  await persistStage(plan.upserts.streets, async (street) => {
    await repository.upsertWasteStreet({ id: street.id, name: street.name, cityId: street.cityId });
  });
  await persistStage(plan.upserts.houseNumbers, async (houseNumber) => {
    await repository.upsertWasteHouseNumber({
      id: houseNumber.id,
      number: houseNumber.number,
      streetId: houseNumber.streetId,
    });
  });
  await persistStage(plan.upserts.locations, async (location) => {
    await repository.upsertWasteCollectionLocation({
      id: location.id,
      cityId: location.cityId,
      regionId: location.regionId,
      streetId: location.streetId,
      houseNumberId: location.houseNumberId,
      active: location.active,
    });
  });
  await persistStage(plan.upserts.fractions, async (fraction) => {
    await repository.upsertWasteFraction({
      id: fraction.id,
      name: fraction.name,
      translations: fraction.translations,
      containerSize: fraction.containerSize,
      color: fraction.color,
      description: fraction.description,
      active: fraction.active,
      reminderConfig: fraction.reminderConfig,
    });
  });
  await persistStage(plan.upserts.tours, async (tour) => {
    await repository.upsertWasteTour({
      id: tour.id,
      name: tour.name,
      description: tour.description,
      wasteFractionIds: tour.wasteFractionIds,
      recurrence: tour.recurrence,
      firstDate: tour.firstDate,
      endDate: tour.endDate,
      customDates: tour.customDates,
      status: tour.status,
    });
  });
  await persistStage(plan.upserts.assignments, async (assignment) => {
    await repository.upsertWasteLocationTourLink({
      id: assignment.id,
      locationId: assignment.locationId,
      tourId: assignment.tourId,
    });
  });
  await persistStage(assignments, async (assignment) => {
    await repository.upsertWasteTourAssignment(assignment);
  });
};

export const executeGeographyImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    await repository.upsertWasteRegion({ id: row.region_id, name: row.region_name });
    await repository.upsertWasteCity({
      id: row.city_id,
      name: row.city_name,
      regionId: row.region_id,
    });
    counts.upserts += 2;
    if (normalizeOptionalText(row.street_id) && normalizeOptionalText(row.street_name)) {
      await repository.upsertWasteStreet({
        id: row.street_id,
        name: row.street_name,
        cityId: row.city_id,
      });
      counts.upserts += 1;
    }
    if (
      normalizeOptionalText(row.house_number_id) &&
      normalizeOptionalText(row.house_number_value) &&
      normalizeOptionalText(row.street_id)
    ) {
      await repository.upsertWasteHouseNumber({
        id: row.house_number_id,
        number: row.house_number_value,
        streetId: row.street_id,
      });
      counts.upserts += 1;
    }
    await repository.upsertWasteCollectionLocation({
      id: row.location_id,
      regionId: normalizeOptionalText(row.region_id),
      cityId: row.city_id,
      streetId: normalizeOptionalText(row.street_id),
      houseNumberId: normalizeOptionalText(row.house_number_id),
      active: parseBoolean(row.active, 'active'),
    });
    counts.upserts += 1;
  }

  return counts;
};

export const executeToursImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    const status = normalizeOptionalText(row.status);
    const legacyActive = normalizeOptionalText(row.active);
    const normalizedStatus =
      status ??
      (legacyActive === undefined
        ? 'draft'
        : parseBoolean(legacyActive, 'active')
          ? 'published'
          : 'draft');
    if (!wasteTourStatuses.includes(normalizedStatus as (typeof wasteTourStatuses)[number])) {
      throw new Error(`invalid_tour_status:${normalizedStatus}`);
    }
    await repository.upsertWasteTour({
      id: row.tour_id,
      name: row.tour_name,
      description: normalizeOptionalText(row.description),
      wasteFractionIds: parseDelimitedStringArray(row.waste_fraction_ids),
      recurrence: parseRecurrence(row.recurrence) ?? null,
      firstDate: normalizeOptionalText(row.first_date),
      endDate: normalizeOptionalText(row.end_date),
      customDates: parseCustomDates(row.custom_dates),
      status: normalizedStatus as (typeof wasteTourStatuses)[number],
    });
    counts.upserts += 1;
  }

  return counts;
};

export const executeDateShiftImport = async (
  repository: WasteRepository,
  rows: readonly GenericImportRow[],
  counts: { rows: number; upserts: number }
) => {
  for (const row of rows) {
    const shiftContext = normalizeOptionalText(row.shift_context);
    if (shiftContext !== 'global' && shiftContext !== 'tour') {
      throw new Error(`invalid_shift_context:${row.shift_context}`);
    }
    if (shiftContext === 'tour') {
      const tourId = normalizeOptionalText(row.tour_id);
      if (!tourId) throw new Error(`missing_tour_id:${row.shift_id}`);
      await repository.upsertWasteTourDateShift({
        id: row.shift_id,
        tourId,
        originalDate: row.original_date,
        actualDate: row.actual_date,
        hasYear: parseBoolean(row.has_year, 'has_year'),
        reasonType: parseReasonType(wasteManagementMasterDataContract, row.reason_type),
        reasonKey: normalizeOptionalText(row.reason_key),
        followUpMode: parseFollowUpMode(wasteManagementMasterDataContract, row.follow_up_mode),
        description: normalizeOptionalText(row.description),
      });
      counts.upserts += 1;
      continue;
    }
    await repository.upsertWasteGlobalDateShift({
      id: row.shift_id,
      originalDate: row.original_date,
      actualDate: row.actual_date,
      hasYear: parseBoolean(row.has_year, 'has_year'),
      reasonType: parseReasonType(wasteManagementMasterDataContract, row.reason_type),
      reasonKey: normalizeOptionalText(row.reason_key),
      description: normalizeOptionalText(row.description),
      tourIds: parseDelimitedStringArray(row.tour_ids),
    });
    counts.upserts += 1;
  }

  return counts;
};
