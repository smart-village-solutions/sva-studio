import {
  buildWasteAnnualTourTransferFingerprint,
  buildWasteAnnualTourTransferPreview,
  toWasteAnnualTourTransferPublicPreview,
  type WasteAnnualTourTransferCreateInput,
  type WasteAnnualTourTransferMappedTour,
  type WasteAnnualTourTransferResult,
  type WasteAnnualTourTransferSource,
} from '@sva/waste-management-contracts';
import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '@sva/data-repositories';
import { createWasteMasterDataRepository } from './master-data.js';
import { writeWasteAnnualMappedTours } from './annual-tour-transfer-write.js';

type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;
type WasteAnnualTourTransferClient = {
  query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
    readonly rowCount: number | null;
    readonly rows: readonly TRow[];
  }>;
};

const createSqlExecutor = (client: WasteAnnualTourTransferClient): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return { rowCount: result.rowCount ?? 0, rows: result.rows };
  },
});

export const loadWasteAnnualTourTransferSource = async (
  repository: WasteRepository
): Promise<WasteAnnualTourTransferSource> => {
  const [tours, locationTourLinks, locationTourPickupDates, tourAssignments, tourDateShifts] =
    await Promise.all([
      repository.listWasteTours(),
      repository.listWasteLocationTourLinks(),
      repository.listWasteLocationTourPickupDates(),
      repository.listWasteTourAssignments(),
      repository.listWasteTourDateShifts(),
    ]);
  return { tours, locationTourLinks, locationTourPickupDates, tourAssignments, tourDateShifts };
};

const comparableMappedTour = (
  snapshot: WasteAnnualTourTransferSource,
  mapped: WasteAnnualTourTransferMappedTour
): WasteAnnualTourTransferMappedTour | null => {
  const targetTour = snapshot.tours.find((tour) => tour.id === mapped.targetTour.id);
  if (!targetTour) return null;
  return {
    sourceTourId: mapped.sourceTourId,
    targetTour: {
      id: targetTour.id,
      name: targetTour.name,
      description: targetTour.description,
      wasteFractionIds: targetTour.wasteFractionIds,
      recurrence: targetTour.recurrence,
      customRecurrenceId: targetTour.customRecurrenceId,
      customRecurrenceName: targetTour.customRecurrenceName,
      customRecurrenceIntervalDays: targetTour.customRecurrenceIntervalDays,
      firstDate: targetTour.firstDate,
      endDate: targetTour.endDate,
      customDates: targetTour.customDates,
      status: targetTour.status,
      locationCount: targetTour.locationCount,
    },
    locationTourLinks: snapshot.locationTourLinks
      .filter((item) => item.tourId === targetTour.id)
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item),
    locationTourPickupDates: snapshot.locationTourPickupDates
      .filter((item) => item.tourId === targetTour.id)
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item),
    tourAssignments: snapshot.tourAssignments
      .filter((item) => item.tourId === targetTour.id)
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item),
    tourDateShifts: snapshot.tourDateShifts
      .filter((item) => item.tourId === targetTour.id)
      .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item),
  };
};

const mappedTourMatches = async (
  snapshot: WasteAnnualTourTransferSource,
  mapped: WasteAnnualTourTransferMappedTour
): Promise<boolean> => {
  const current = comparableMappedTour(snapshot, mapped);
  if (!current) return false;
  const normalize = (value: WasteAnnualTourTransferMappedTour) => ({
    ...value,
    locationTourLinks: [...value.locationTourLinks].sort((a, b) => a.id.localeCompare(b.id)),
    locationTourPickupDates: [...value.locationTourPickupDates].sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    tourAssignments: [...value.tourAssignments].sort((a, b) => a.id.localeCompare(b.id)),
    tourDateShifts: [...value.tourDateShifts].sort((a, b) => a.id.localeCompare(b.id)),
  });
  return (
    (await buildWasteAnnualTourTransferFingerprint(normalize(current))) ===
    (await buildWasteAnnualTourTransferFingerprint(normalize(mapped)))
  );
};

export const createWasteAnnualTourTransferInTransaction = async (input: {
  readonly client: WasteAnnualTourTransferClient;
  readonly instanceId: string;
  readonly create: WasteAnnualTourTransferCreateInput;
  readonly currentYear?: number;
}): Promise<WasteAnnualTourTransferResult> => {
  const { client } = input;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      `waste-annual-tour-transfer:${input.create.sourceYear + 1}`,
    ]);
    await client.query(`
LOCK TABLE
  waste_tours,
  waste_custom_recurrence_presets,
  waste_location_tour_links,
  waste_location_tour_pickup_dates,
  waste_tour_assignments,
  waste_tour_assignment_locations,
  waste_tour_date_shifts
IN SHARE ROW EXCLUSIVE MODE;`);
    const repository = createWasteMasterDataRepository(createSqlExecutor(client));
    const snapshot = await loadWasteAnnualTourTransferSource(repository);
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: input.instanceId,
      sourceYear: input.create.sourceYear,
      currentYear: input.currentYear ?? new Date().getUTCFullYear(),
      source: snapshot,
      target: snapshot,
      selectedTourIds: input.create.selectedTourIds,
      replacementDates: input.create.replacementDates,
      allowObsoleteReplacementDates: true,
    });
    if (preview.previewFingerprint !== input.create.previewFingerprint) {
      throw new Error(
        `preview_stale:${JSON.stringify(toWasteAnnualTourTransferPublicPreview(preview))}`
      );
    }
    const acknowledgements = new Set(input.create.acknowledgedConflictTourIds);
    const selected = new Set(input.create.selectedTourIds);
    const selectedPreviews = preview.tours.filter((item) => selected.has(item.sourceTourId));
    if (
      selectedPreviews.length !== selected.size ||
      selectedPreviews.some((item) => item.classification !== 'transferable' || !item.mappedTour)
    ) {
      throw new Error('invalid_transfer_selection');
    }
    if (
      selectedPreviews.some(
        (item) => item.conflicts.length > 0 && !acknowledgements.has(item.sourceTourId)
      )
    ) {
      throw new Error('unacknowledged_target_conflict');
    }

    const createdTourIds: string[] = [];
    const existingTourIds: string[] = [];
    const mappedToursToCreate: WasteAnnualTourTransferMappedTour[] = [];
    for (const item of selectedPreviews) {
      const mapped = item.mappedTour as WasteAnnualTourTransferMappedTour;
      const existing = snapshot.tours.some((tour) => tour.id === mapped.targetTour.id);
      if (existing) {
        if (!(await mappedTourMatches(snapshot, mapped))) {
          throw new Error(
            `target_identity_conflict:${JSON.stringify(toWasteAnnualTourTransferPublicPreview(preview))}`
          );
        }
        existingTourIds.push(mapped.targetTour.id);
        continue;
      }
      mappedToursToCreate.push(mapped);
      createdTourIds.push(mapped.targetTour.id);
    }
    await writeWasteAnnualMappedTours(client, repository, mappedToursToCreate);
    await client.query('COMMIT');
    return {
      sourceYear: input.create.sourceYear,
      targetYear: preview.targetYear,
      createdTourIds,
      existingTourIds,
      createdCount: createdTourIds.length,
      existingCount: existingTourIds.length,
      classificationCounts: {
        transferable: preview.summary.transferable,
        alreadyEffective: preview.summary.alreadyEffective,
        blocked: preview.summary.blocked,
      },
      listTarget: {
        tourValidityPeriod: preview.targetYear === new Date().getUTCFullYear() ? 'current' : 'next',
        status: 'draft',
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};
