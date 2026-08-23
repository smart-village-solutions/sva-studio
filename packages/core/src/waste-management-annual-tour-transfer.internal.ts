import type {
  WasteAnnualTourTransferMappedTour,
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferTourPreview,
} from './waste-management-annual-tour-transfer.contract.js';

export type WasteAnnualTourTransferInternalTourPreview = WasteAnnualTourTransferTourPreview &
  Readonly<{ mappedTour?: WasteAnnualTourTransferMappedTour }>;

export type WasteAnnualTourTransferInternalPreview = Omit<WasteAnnualTourTransferPreview, 'tours'> &
  Readonly<{ tours: readonly WasteAnnualTourTransferInternalTourPreview[] }>;
