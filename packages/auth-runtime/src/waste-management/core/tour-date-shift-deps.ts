import type { WasteTourDateShiftRecord } from '@sva/waste-management-contracts';

type WasteTourDateShiftWriteInput = Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>;

export type WasteTourDateShiftWriter = (
  instanceId: string,
  input: WasteTourDateShiftWriteInput
) => Promise<void>;
