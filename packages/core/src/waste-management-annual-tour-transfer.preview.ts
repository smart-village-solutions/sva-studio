import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  assertWasteAnnualTourTransferLimits,
  type WasteAnnualTourTransferPreview,
  type WasteAnnualTourTransferReplacementDate,
  type WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  findWasteAnnualTourConflicts,
  sortWasteAnnualItems,
  wasteAnnualEffectiveDates,
} from './waste-management-annual-tour-transfer.conflicts.js';
import { createWasteAnnualTourConflictIndex } from './waste-management-annual-tour-transfer.conflict-index.js';
import { deriveWasteAnnualTourTransferTargetYear } from './waste-management-annual-tour-transfer.dates.js';
import { buildWasteAnnualTourTransferFingerprint } from './waste-management-annual-tour-transfer.identity.js';
import {
  countWasteAnnualMappedRelationships,
  wasteAnnualConcreteDateExamples,
} from './waste-management-annual-tour-transfer.examples.js';
import type * as AnnualTransferInternal from './waste-management-annual-tour-transfer.internal.js';
import { mapWasteAnnualTour } from './waste-management-annual-tour-transfer.mapping.js';
import {
  isWasteAnnualTourAlreadyEffective,
  isWasteAnnualTourRelevant,
  wasteAnnualTourHasMissingCadenceAnchor,
  wasteAnnualTourRelationshipCounts,
} from './waste-management-annual-tour-transfer.relevance.js';
import {
  buildValidatedWasteAnnualReplacementMap,
  wasteAnnualReplacementTargetYearsFor,
} from './waste-management-annual-tour-transfer.replacements.js';

type InternalTourPreview = AnnualTransferInternal.WasteAnnualTourTransferInternalTourPreview;

type PreviewTourInput = Readonly<{
  instanceId: string;
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: WasteAnnualTourTransferSource;
  target: WasteAnnualTourTransferSource;
  conflictIndex: ReturnType<typeof createWasteAnnualTourConflictIndex>;
  replacements: ReadonlyMap<string, string>;
}>;

const previewReplacementResources = (
  input: PreviewTourInput,
  requiredResourceIds: readonly string[] = []
) => {
  const requestedIds = [...new Set([...requiredResourceIds, ...input.replacements.keys()])];
  const targetYears = wasteAnnualReplacementTargetYearsFor(input, requestedIds);
  return {
    resourceIds: [...new Set([...requiredResourceIds, ...Object.keys(targetYears)])],
    targetYears,
  } as const;
};

const previewTour = async (input: PreviewTourInput): Promise<InternalTourPreview> => {
  const counts = wasteAnnualTourRelationshipCounts(input.tour, input.sourceYear, input.source);
  const common = {
    sourceTourId: input.tour.id,
    name: input.tour.name,
    sourcePeriod: { firstDate: input.tour.firstDate, endDate: input.tour.endDate },
    recurrence: input.tour.recurrence,
    customRecurrenceName: input.tour.customRecurrenceName,
    customRecurrenceIntervalDays: input.tour.customRecurrenceIntervalDays,
    relationshipCounts: counts,
  } as const;
  if (
    !wasteAnnualTourHasMissingCadenceAnchor(input.tour) &&
    isWasteAnnualTourAlreadyEffective(input.tour, input.targetYear, input.source)
  ) {
    return {
      ...common,
      classification: 'already-effective',
      reasonCode: 'already_effective_in_target_year',
      replacementResourceIds: [],
      replacementTargetYears: {},
      dateExamples: [],
      conflicts: [],
    };
  }
  const mappedResult = await mapWasteAnnualTour(input);
  if ('blocker' in mappedResult) {
    const replacements = previewReplacementResources(input, mappedResult.replacementResourceIds);
    return {
      ...common,
      classification: 'blocked',
      reasonCode: mappedResult.blocker,
      replacementResourceIds: replacements.resourceIds,
      replacementTargetYears: replacements.targetYears,
      dateExamples: [],
      conflicts: [],
    };
  }
  const conflicts = findWasteAnnualTourConflicts(
    input.tour.id,
    mappedResult.mapped,
    input.conflictIndex
  );
  const identityConflict = conflicts.some(
    (conflict) => conflict.kind === 'target-identity-conflict'
  );
  const replacements = previewReplacementResources(input);
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
    replacementResourceIds: replacements.resourceIds,
    replacementTargetYears: replacements.targetYears,
    dateExamples: wasteAnnualConcreteDateExamples(
      input.tour,
      input.sourceYear,
      input.source,
      mappedResult.mapped
    ),
    conflicts,
    mappedTour: mappedResult.mapped,
  };
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
  allowObsoleteReplacementDates?: boolean;
}): Promise<AnnualTransferInternal.WasteAnnualTourTransferInternalPreview> => {
  const targetYear = deriveWasteAnnualTourTransferTargetYear(input.sourceYear, input.currentYear);
  const relevantTours = input.source.tours.filter((tour) =>
    isWasteAnnualTourRelevant(tour, input.sourceYear, input.source)
  );
  assertWasteAnnualTourTransferLimits({ tours: relevantTours.length, relationships: 0 });
  const replacementDates = input.replacementDates ?? [];
  const replacements = buildValidatedWasteAnnualReplacementMap({
    ...input,
    targetYear,
    relevantTours,
    replacementDates,
    allowObsoleteReplacementDates: input.allowObsoleteReplacementDates,
  });
  const conflictIndex = createWasteAnnualTourConflictIndex(input.target);
  const previews = await Promise.all(
    sortWasteAnnualItems(relevantTours, (tour) => tour.id).map((tour) =>
      previewTour({ ...input, tour, targetYear, conflictIndex, replacements })
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
    (total, item) => total + countWasteAnnualMappedRelationships(item),
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
  preview: AnnualTransferInternal.WasteAnnualTourTransferInternalPreview
): WasteAnnualTourTransferPreview => ({
  ...preview,
  tours: preview.tours.map(({ mappedTour: _mappedTour, ...tour }) => tour),
});
