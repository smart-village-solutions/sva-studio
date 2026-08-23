import type {
  WasteLocationTourLinkRecord,
  WasteTourRecord,
} from './waste-management/master-data-tours.js';
import type {
  WasteLocationTourPickupDateRecord,
  WasteTourAssignmentRecord,
  WasteTourDateShiftRecord,
} from './waste-management/master-data-scheduling.js';

export const wasteAnnualTourTransferLimits = { tours: 1_000, relationships: 100_000 } as const;

export class WasteAnnualTourTransferError extends Error {
  public constructor(
    public readonly code:
      'invalid_source_year' | 'batch_limit_exceeded' | 'replacement_date_invalid'
  ) {
    super(code);
    this.name = 'WasteAnnualTourTransferError';
  }
}

export const assertWasteAnnualTourTransferLimits = (counts: {
  readonly tours: number;
  readonly relationships: number;
}): void => {
  if (
    counts.tours > wasteAnnualTourTransferLimits.tours ||
    counts.relationships > wasteAnnualTourTransferLimits.relationships
  ) {
    throw new WasteAnnualTourTransferError('batch_limit_exceeded');
  }
};

export type WasteAnnualTourTransferClassification =
  'transferable' | 'already-effective' | 'blocked';
export type WasteAnnualTourTransferReplacementDate = Readonly<{
  sourceResourceId: string;
  targetDate: string;
}>;
export type WasteAnnualTourTransferConflict = Readonly<{
  kind: 'possible-parallel-planning' | 'target-identity-conflict';
  sourceTourId: string;
  targetTourId: string;
  matchingFeatures: readonly string[];
}>;
export type WasteAnnualTourTransferSource = Readonly<{
  tours: readonly WasteTourRecord[];
  locationTourLinks: readonly WasteLocationTourLinkRecord[];
  locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  tourAssignments: readonly WasteTourAssignmentRecord[];
  tourDateShifts: readonly WasteTourDateShiftRecord[];
}>;
export type WasteAnnualTourTransferMappedTour = Readonly<{
  sourceTourId: string;
  targetTour: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>;
  locationTourLinks: readonly Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>[];
  locationTourPickupDates: readonly Omit<
    WasteLocationTourPickupDateRecord,
    'createdAt' | 'updatedAt'
  >[];
  tourAssignments: readonly Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>[];
  tourDateShifts: readonly Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>[];
}>;
export type WasteAnnualTourTransferTourPreview = Readonly<{
  sourceTourId: string;
  name: string;
  classification: WasteAnnualTourTransferClassification;
  reasonCode?:
    | 'already_effective_in_target_year'
    | 'invalid_planning_data'
    | 'replacement_date_required'
    | 'target_date_collision'
    | 'target_identity_conflict';
  sourcePeriod?: Readonly<{ firstDate?: string; endDate?: string }>;
  targetPeriod?: Readonly<{ firstDate?: string; endDate?: string }>;
  firstTargetDate?: string;
  recurrence?: WasteTourRecord['recurrence'];
  customRecurrenceName?: string;
  customRecurrenceIntervalDays?: number;
  dateExamples: readonly Readonly<{ sourceDate: string; targetDate: string }>[];
  relationshipCounts: Readonly<{
    wasteFractions: number;
    customDates: number;
    locations: number;
    pickupDates: number;
    assignments: number;
    shifts: number;
    excluded: number;
  }>;
  replacementResourceIds: readonly string[];
  replacementTargetYears: Readonly<Record<string, number>>;
  conflicts: readonly WasteAnnualTourTransferConflict[];
}>;
export type WasteAnnualTourTransferPreview = Readonly<{
  sourceYear: number;
  targetYear: number;
  previewFingerprint: string;
  tours: readonly WasteAnnualTourTransferTourPreview[];
  summary: Readonly<{
    transferable: number;
    alreadyEffective: number;
    blocked: number;
    selected: number;
    relationships: number;
    excluded: number;
  }>;
}>;
export type WasteAnnualTourTransferCreateInput = Readonly<{
  sourceYear: number;
  selectedTourIds: readonly string[];
  replacementDates: readonly WasteAnnualTourTransferReplacementDate[];
  acknowledgedConflictTourIds: readonly string[];
  previewFingerprint: string;
}>;
export type WasteAnnualTourTransferResult = Readonly<{
  sourceYear: number;
  targetYear: number;
  createdTourIds: readonly string[];
  existingTourIds: readonly string[];
  createdCount: number;
  existingCount: number;
  classificationCounts: Readonly<{
    transferable: number;
    alreadyEffective: number;
    blocked: number;
  }>;
  listTarget: Readonly<{
    tourValidityPeriod: 'current' | 'next';
    status: 'inactive';
  }>;
}>;
