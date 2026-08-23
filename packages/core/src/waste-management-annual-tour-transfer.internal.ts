import type {
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferTourPreview,
} from './waste-management-annual-tour-transfer.contract.js';
import type { WasteTourRecord } from './waste-management/master-data-tours.js';

export type WasteAnnualTourTransferInternalTourPreview = WasteAnnualTourTransferTourPreview &
  Readonly<{ mappedTour?: WasteAnnualTourTransferMappedTour }>;

export type WasteAnnualTourTransferInternalPreview = Omit<WasteAnnualTourTransferPreview, 'tours'> &
  Readonly<{ tours: readonly WasteAnnualTourTransferInternalTourPreview[] }>;

export type WasteAnnualTourMappingInput = Readonly<{
  instanceId: string;
  tour: WasteTourRecord;
  sourceYear: number;
  targetYear: number;
  source: import('./waste-management-annual-tour-transfer.contract.js').WasteAnnualTourTransferSource;
  replacements: ReadonlyMap<string, string>;
}>;

export type WasteAnnualTourMappingBlocker = Readonly<{
  blocker: 'invalid_planning_data' | 'replacement_date_required' | 'target_date_collision';
  replacementResourceIds: readonly string[];
}>;
