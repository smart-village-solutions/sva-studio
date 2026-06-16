import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';

import type { GraphqlExecutor } from './shared.js';
import {
  CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE,
  createWastePickupTimesWithConfig,
  deleteWastePickupTimesWithConfig,
  listWasteSyncSnapshotWithConfig,
  type SvaMainserverWasteSyncItem,
  type SvaMainserverWasteSyncSnapshot,
} from './waste-operations.shared.js';

export type { SvaMainserverWasteSyncItem, SvaMainserverWasteSyncSnapshot };
export { CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE };

export const createWasteOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listWasteSyncSnapshotWithConfig: (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverWasteSyncSnapshot> =>
    listWasteSyncSnapshotWithConfig(executeGraphqlWithConfig, input, config),

  createWastePickupTimesWithConfig: (
    input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] },
    config: SvaMainserverInstanceConfig
  ): Promise<void> => createWastePickupTimesWithConfig(executeGraphqlWithConfig, input, config),

  deleteWastePickupTimesWithConfig: (
    input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] },
    config: SvaMainserverInstanceConfig
  ): Promise<void> => deleteWastePickupTimesWithConfig(executeGraphqlWithConfig, input, config),
});
