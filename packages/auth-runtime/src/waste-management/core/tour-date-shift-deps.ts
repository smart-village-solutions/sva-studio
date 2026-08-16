import type { WasteTourDateShiftRecord } from '@sva/core';

type WasteTourDateShiftWriteInput = Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>;

export type WasteTourDateShiftWriter = (
  instanceId: string,
  input: WasteTourDateShiftWriteInput
) => Promise<void>;
