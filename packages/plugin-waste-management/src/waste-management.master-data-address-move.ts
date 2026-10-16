import type { WasteAddressEntityType } from '@sva/waste-management-contracts';

import { previewWasteAddressMutation } from './waste-management.api.js';
import { applySuccess } from './use-waste-master-data-state.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { Translate } from './waste-management.master-data.submission.types.js';

export const confirmWasteAddressMove = async (input: {
  readonly state: WasteMasterDataState;
  readonly pt: Translate;
  readonly entityType: WasteAddressEntityType;
  readonly entityId: string;
  readonly targetParentId?: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly save: (confirmationToken: string) => Promise<unknown>;
  readonly closeDialog: () => void;
  readonly successMessage: string;
  readonly loadOverview: (active?: boolean) => Promise<void>;
  readonly loadCollectionLocationList: () => Promise<void>;
}) => {
  const preview = await previewWasteAddressMutation({
    entityType: input.entityType,
    entityId: input.entityId,
    mode: 'move',
    ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}),
  });
  if (preview.counts.inconsistentCollectionLocations > 0) {
    throw new Error('address_data_inconsistent');
  }

  const saveConfirmedMove = async (confirmationToken: string) => {
    await input.save(confirmationToken);
    await Promise.all([input.loadOverview(true), input.loadCollectionLocationList()]);
    input.state.setPendingAddressMove(null);
    applySuccess(input.closeDialog, input.state.setMessage, input.successMessage);
  };

  const setPendingPreview = (currentPreview: typeof preview) => {
    input.state.setPendingAddressMove({
      preview: currentPreview,
      sourceLabel: input.sourceLabel,
      targetLabel: input.targetLabel,
      onConfirm: () => saveConfirmedMove(currentPreview.token),
      refresh: async () => {
        const freshPreview = await previewWasteAddressMutation({
          entityType: input.entityType,
          entityId: input.entityId,
          mode: 'move',
          ...(input.targetParentId ? { targetParentId: input.targetParentId } : {}),
        });
        if (freshPreview.counts.inconsistentCollectionLocations > 0) throw new Error('address_data_inconsistent');
        setPendingPreview(freshPreview);
      },
    });
  };
  setPendingPreview(preview);
  return 'confirmation-required' as const;
};
