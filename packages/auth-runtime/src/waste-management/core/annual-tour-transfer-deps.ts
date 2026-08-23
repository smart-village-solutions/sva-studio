import type {
  WasteAnnualTourTransferCreateInput,
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/core';

export type WasteAnnualTourTransferHandlerDeps = {
  readonly previewWasteAnnualTourTransfer?: (input: {
    readonly instanceId: string;
    readonly sourceYear: number;
    readonly selectedTourIds?: readonly string[];
    readonly replacementDates?: WasteAnnualTourTransferCreateInput['replacementDates'];
  }) => Promise<WasteAnnualTourTransferPreview>;
  readonly createWasteAnnualTourTransfer?: (input: {
    readonly instanceId: string;
    readonly create: WasteAnnualTourTransferCreateInput;
  }) => Promise<WasteAnnualTourTransferResult>;
};
