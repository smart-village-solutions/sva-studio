import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  assertWasteAnnualTourTransferLimits,
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferPreview,
  type WasteAnnualTourTransferReplacementDate,
  type WasteAnnualTourTransferSource,
  type WasteAnnualTourTransferTourPreview,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  findWasteAnnualTourConflicts,
  sortWasteAnnualItems,
  wasteAnnualEffectiveDates,
  wasteAnnualTourOverlapsYear,
} from './waste-management-annual-tour-transfer.conflicts.js';
import {
  deriveWasteAnnualTourTransferTargetYear,
  isWasteAnnualDateInYear,
} from './waste-management-annual-tour-transfer.dates.js';
import { buildWasteAnnualTourTransferFingerprint } from './waste-management-annual-tour-transfer.identity.js';
import { mapWasteAnnualTour } from './waste-management-annual-tour-transfer.mapping.js';
import { wasteAnnualRelationshipsFor } from './waste-management-annual-tour-transfer.relationships.js';

type WasteAnnualTourTransferInternalTourPreview = WasteAnnualTourTransferTourPreview &
  Readonly<{
    mappedTour?: import('./waste-management-annual-tour-transfer.contract.js').WasteAnnualTourTransferMappedTour;
  }>;
type WasteAnnualTourTransferInternalPreview = Omit<WasteAnnualTourTransferPreview, 'tours'> &
  Readonly<{ tours: readonly WasteAnnualTourTransferInternalTourPreview[] }>;

const isRelevantTour = (
  tour: WasteTourRecord,
  year: number,
  source: WasteAnnualTourTransferSource
) =>
  tour.active &&
  (wasteAnnualTourOverlapsYear(tour, year) ||
    (tour.customDates ?? []).some((item) => isWasteAnnualDateInYear(item.date, year)) ||
    wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).some((item) =>
      isWasteAnnualDateInYear(item.pickupDate, year)
    ) ||
    wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).some((item) =>
      isWasteAnnualDateInYear(item.pickupDate, year)
    ));

const relationshipCounts = (
  tour: WasteTourRecord,
  sourceYear: number,
  source: WasteAnnualTourTransferSource
) => ({
  wasteFractions: tour.wasteFractionIds.length,
  customDates: (tour.customDates ?? []).filter((item) =>
    isWasteAnnualDateInYear(item.date, sourceYear)
  ).length,
  locations: wasteAnnualRelationshipsFor(source.locationTourLinks, tour.id).length,
  pickupDates: wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).filter((item) =>
    isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  ).length,
  assignments: wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).filter((item) =>
    isWasteAnnualDateInYear(item.pickupDate, sourceYear)
  ).length,
  shifts: wasteAnnualRelationshipsFor(source.tourDateShifts, tour.id).filter(
    (item) => !item.hasYear || isWasteAnnualDateInYear(item.originalDate, sourceYear)
  ).length,
  excluded: 0,
});

const alreadyEffective = (
  tour: WasteTourRecord,
  targetYear: number,
  source: WasteAnnualTourTransferSource
) =>
  wasteAnnualTourOverlapsYear(tour, targetYear) ||
  (tour.customDates ?? []).some((item) => isWasteAnnualDateInYear(item.date, targetYear)) ||
  wasteAnnualRelationshipsFor(source.locationTourPickupDates, tour.id).some((item) =>
    isWasteAnnualDateInYear(item.pickupDate, targetYear)
  ) ||
  wasteAnnualRelationshipsFor(source.tourAssignments, tour.id).some((item) =>
    isWasteAnnualDateInYear(item.pickupDate, targetYear)
  );

type PreviewTourInput = Readonly<{
  instanceId: string;
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: WasteAnnualTourTransferSource;
  target: WasteAnnualTourTransferSource;
  replacements: ReadonlyMap<string, string>;
}>;

const previewTour = async (
  input: PreviewTourInput
): Promise<WasteAnnualTourTransferInternalTourPreview> => {
  const counts = relationshipCounts(input.tour, input.sourceYear, input.source);
  const common = {
    sourceTourId: input.tour.id,
    name: input.tour.name,
    sourcePeriod: { firstDate: input.tour.firstDate, endDate: input.tour.endDate },
    recurrence: input.tour.recurrence,
    relationshipCounts: counts,
  } as const;
  if (alreadyEffective(input.tour, input.targetYear, input.source)) {
    return {
      ...common,
      classification: 'already-effective',
      reasonCode: 'already_effective_in_target_year',
      replacementResourceIds: [],
      conflicts: [],
    };
  }
  const mappedResult = await mapWasteAnnualTour(input);
  if ('blocker' in mappedResult) {
    return {
      ...common,
      classification: 'blocked',
      reasonCode: mappedResult.blocker,
      replacementResourceIds: mappedResult.replacementResourceIds,
      conflicts: [],
    };
  }
  const conflicts = findWasteAnnualTourConflicts(input.tour.id, mappedResult.mapped, input.target);
  const identityConflict = conflicts.some(
    (conflict) => conflict.kind === 'target-identity-conflict'
  );
  return {
    ...common,
    classification: identityConflict ? 'blocked' : 'transferable',
    ...(identityConflict ? { reasonCode: 'target_identity_conflict' as const } : {}),
    targetPeriod: {
      firstDate: mappedResult.mapped.targetTour.firstDate,
      endDate: mappedResult.mapped.targetTour.endDate,
    },
    firstTargetDate: [...wasteAnnualEffectiveDates(mappedResult.mapped)].sort()[0],
    relationshipCounts: { ...counts, excluded: mappedResult.excluded },
    replacementResourceIds: [],
    conflicts,
    mappedTour: mappedResult.mapped,
  };
};

const mappedRelationshipCount = (item: WasteAnnualTourTransferInternalTourPreview): number => {
  const mapped = item.mappedTour;
  return mapped
    ? mapped.targetTour.wasteFractionIds.length +
        (mapped.targetTour.customDates?.length ?? 0) +
        mapped.locationTourLinks.length +
        mapped.locationTourPickupDates.length +
        mapped.tourAssignments.length +
        mapped.tourDateShifts.length
    : 0;
};

const sourceFingerprintState = (
  tours: readonly WasteTourRecord[],
  source: WasteAnnualTourTransferSource
) => {
  const ids = new Set(tours.map((tour) => tour.id));
  const relevant = <T extends { readonly id: string; readonly tourId: string }>(
    items: readonly T[]
  ) =>
    sortWasteAnnualItems(
      items.filter((item) => ids.has(item.tourId)),
      (item) => item.id
    );
  return {
    tours: sortWasteAnnualItems(tours, (tour) => tour.id),
    locationTourLinks: relevant(source.locationTourLinks),
    locationTourPickupDates: relevant(source.locationTourPickupDates),
    tourAssignments: relevant(source.tourAssignments),
    tourDateShifts: relevant(source.tourDateShifts),
  };
};

export const buildWasteAnnualTourTransferPreview = async (input: {
  instanceId: string;
  sourceYear: number;
  currentYear: number;
  source: WasteAnnualTourTransferSource;
  target: WasteAnnualTourTransferSource;
  selectedTourIds?: readonly string[];
  replacementDates?: readonly WasteAnnualTourTransferReplacementDate[];
}): Promise<WasteAnnualTourTransferInternalPreview> => {
  const targetYear = deriveWasteAnnualTourTransferTargetYear(input.sourceYear, input.currentYear);
  for (const replacement of input.replacementDates ?? []) {
    if (!isWasteAnnualDateInYear(replacement.targetDate, targetYear)) {
      throw new WasteAnnualTourTransferError('replacement_date_invalid');
    }
  }
  const relevantTours = input.source.tours.filter((tour) =>
    isRelevantTour(tour, input.sourceYear, input.source)
  );
  assertWasteAnnualTourTransferLimits({ tours: relevantTours.length, relationships: 0 });
  const replacements = new Map(
    (input.replacementDates ?? []).map((item) => [item.sourceResourceId, item.targetDate] as const)
  );
  const previews = await Promise.all(
    sortWasteAnnualItems(relevantTours, (tour) => tour.id).map((tour) =>
      previewTour({ ...input, tour, targetYear, replacements })
    )
  );
  const selected = new Set(
    input.selectedTourIds ??
      previews
        .filter((item) => item.classification === 'transferable' && item.conflicts.length === 0)
        .map((item) => item.sourceTourId)
  );
  const selectedPreviews = previews.filter(
    (item) => item.classification === 'transferable' && selected.has(item.sourceTourId)
  );
  const relationships = selectedPreviews.reduce(
    (total, item) => total + mappedRelationshipCount(item),
    0
  );
  assertWasteAnnualTourTransferLimits({ tours: relevantTours.length, relationships });
  const fingerprintInput = {
    instanceId: input.instanceId,
    sourceYear: input.sourceYear,
    targetYear,
    selectedTourIds: [...selected].sort(),
    replacementDates: sortWasteAnnualItems(
      input.replacementDates ?? [],
      (item) => item.sourceResourceId
    ),
    sourceState: sourceFingerprintState(relevantTours, input.source),
    tours: previews.map((item) => ({
      ...item,
      conflicts: sortWasteAnnualItems(
        item.conflicts,
        (conflict) => `${conflict.kind}:${conflict.targetTourId}`
      ),
    })),
  };
  return {
    sourceYear: input.sourceYear,
    targetYear,
    previewFingerprint: await buildWasteAnnualTourTransferFingerprint(fingerprintInput),
    tours: previews,
    summary: {
      transferable: previews.filter((item) => item.classification === 'transferable').length,
      alreadyEffective: previews.filter((item) => item.classification === 'already-effective')
        .length,
      blocked: previews.filter((item) => item.classification === 'blocked').length,
      selected: selectedPreviews.length,
      relationships,
      excluded: previews.reduce((total, item) => total + item.relationshipCounts.excluded, 0),
    },
  };
};

export const toWasteAnnualTourTransferPublicPreview = (
  preview: WasteAnnualTourTransferInternalPreview
): WasteAnnualTourTransferPreview => ({
  ...preview,
  tours: preview.tours.map(({ mappedTour: _mappedTour, ...tour }) => tour),
});
