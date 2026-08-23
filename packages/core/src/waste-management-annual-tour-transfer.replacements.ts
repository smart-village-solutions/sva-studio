import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferReplacementDate,
  type WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import { isWasteAnnualDateInYear } from './waste-management-annual-tour-transfer.dates.js';
import { findWasteAnnualTourReplacementResourceIds } from './waste-management-annual-tour-transfer.mapping.js';

export const buildValidatedWasteAnnualReplacementMap = (input: {
  readonly instanceId: string;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly source: WasteAnnualTourTransferSource;
  readonly relevantTours: readonly WasteTourRecord[];
  readonly replacementDates: readonly WasteAnnualTourTransferReplacementDate[];
}): ReadonlyMap<string, string> => {
  if (
    input.replacementDates.some(
      (replacement) => !isWasteAnnualDateInYear(replacement.targetDate, input.targetYear)
    )
  ) {
    throw new WasteAnnualTourTransferError('replacement_date_invalid');
  }
  if (input.replacementDates.length === 0) return new Map();
  const allowedResourceIds = new Set(
    input.relevantTours.flatMap((tour) =>
      findWasteAnnualTourReplacementResourceIds({
        instanceId: input.instanceId,
        sourceYear: input.sourceYear,
        targetYear: input.targetYear,
        source: input.source,
        tour,
      })
    )
  );
  const submittedResourceIds = new Set(input.replacementDates.map((item) => item.sourceResourceId));
  if (
    submittedResourceIds.size !== input.replacementDates.length ||
    input.replacementDates.some(
      (replacement) => !allowedResourceIds.has(replacement.sourceResourceId)
    )
  ) {
    throw new WasteAnnualTourTransferError('replacement_date_invalid');
  }
  return new Map(
    input.replacementDates.map((item) => [item.sourceResourceId, item.targetDate] as const)
  );
};
