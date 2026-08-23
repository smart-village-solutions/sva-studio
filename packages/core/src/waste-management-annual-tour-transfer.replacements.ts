import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferReplacementDate,
  type WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  isWasteAnnualDateInYear,
  wasteAnnualYearOf,
} from './waste-management-annual-tour-transfer.dates.js';
import { findWasteAnnualTourReplacementResourceIds } from './waste-management-annual-tour-transfer.mapping.js';
import { wasteAnnualRelationshipsFor } from './waste-management-annual-tour-transfer.relationships.js';

type ReplacementResourceInput = Parameters<typeof findWasteAnnualTourReplacementResourceIds>[0];

export const findWasteAnnualTourReplacementResources = (
  input: ReplacementResourceInput
): readonly Readonly<{ sourceResourceId: string; targetYear: number }>[] => {
  const resourceIds = findWasteAnnualTourReplacementResourceIds(input);
  const shifts = wasteAnnualRelationshipsFor(input.source.tourDateShifts, input.tour.id);
  return resourceIds.map((sourceResourceId) => {
    const actualShift = shifts.find((shift) => `${shift.id}:actual` === sourceResourceId);
    const sourceDateYear = actualShift ? wasteAnnualYearOf(actualShift.actualDate) : null;
    return {
      sourceResourceId,
      targetYear:
        input.targetYear + (sourceDateYear === null ? 0 : sourceDateYear - input.sourceYear),
    };
  });
};

export const wasteAnnualReplacementTargetYearsFor = (
  input: ReplacementResourceInput,
  resourceIds: readonly string[]
): Readonly<Record<string, number>> => {
  const requestedIds = new Set(resourceIds);
  return Object.fromEntries(
    findWasteAnnualTourReplacementResources(input)
      .filter((resource) => requestedIds.has(resource.sourceResourceId))
      .map((resource) => [resource.sourceResourceId, resource.targetYear] as const)
  );
};

export const buildValidatedWasteAnnualReplacementMap = (input: {
  readonly instanceId: string;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly source: WasteAnnualTourTransferSource;
  readonly relevantTours: readonly WasteTourRecord[];
  readonly replacementDates: readonly WasteAnnualTourTransferReplacementDate[];
  readonly allowObsoleteReplacementDates?: boolean;
}): ReadonlyMap<string, string> => {
  if (input.replacementDates.length === 0) return new Map();
  const allowedResources = new Map(
    input.relevantTours
      .flatMap((tour) =>
        findWasteAnnualTourReplacementResources({
          instanceId: input.instanceId,
          sourceYear: input.sourceYear,
          targetYear: input.targetYear,
          source: input.source,
          tour,
        })
      )
      .map((resource) => [resource.sourceResourceId, resource.targetYear] as const)
  );
  const submittedResourceIds = new Set(input.replacementDates.map((item) => item.sourceResourceId));
  const invalidReplacement = input.replacementDates.some((replacement) => {
    const targetYear = allowedResources.get(replacement.sourceResourceId);
    return (
      (targetYear === undefined && !input.allowObsoleteReplacementDates) ||
      (targetYear !== undefined && !isWasteAnnualDateInYear(replacement.targetDate, targetYear))
    );
  });
  if (submittedResourceIds.size !== input.replacementDates.length || invalidReplacement) {
    throw new WasteAnnualTourTransferError('replacement_date_invalid');
  }
  return new Map(
    input.replacementDates
      .filter((item) => allowedResources.has(item.sourceResourceId))
      .map((item) => [item.sourceResourceId, item.targetDate] as const)
  );
};
