import type { SqlExecutor } from '../iam/repositories/types.js';
import type { MediaRepository } from './repository-types.js';
import type { MediaStorageUsageRow, MediaStorageQuotaRow } from './rows.js';
import { mapStorageUsageRow, mapStorageQuotaRow } from './rows.js';
import {
  upsertStorageUsageStatement,
  applyStorageUsageDeltaStatement,
  tryApplyStorageUsageWithinQuotaStatement,
  getStorageUsageStatement,
  upsertStorageQuotaStatement,
  getStorageQuotaStatement,
} from './storage-reference-statements.js';

export const createStorageMethods = (
  executor: SqlExecutor
): Pick<
  MediaRepository,
  | 'upsertStorageUsage'
  | 'applyStorageUsageDelta'
  | 'tryApplyStorageUsageWithinQuota'
  | 'getStorageUsage'
  | 'upsertStorageQuota'
  | 'getStorageQuota'
  | 'wouldExceedStorageQuota'
> => ({
  async upsertStorageUsage(input) {
    await executor.execute(upsertStorageUsageStatement(input));
  },
  async applyStorageUsageDelta(input) {
    await executor.execute(applyStorageUsageDeltaStatement(input));
  },
  async tryApplyStorageUsageWithinQuota(input) {
    const result = await executor.execute<{ readonly claimed: boolean }>(
      tryApplyStorageUsageWithinQuotaStatement(input)
    );
    return result.rows[0]?.claimed === true;
  },
  async getStorageUsage(instanceId) {
    const result = await executor.execute<MediaStorageUsageRow>(
      getStorageUsageStatement(instanceId)
    );
    return result.rows[0] ? mapStorageUsageRow(result.rows[0]) : null;
  },
  async upsertStorageQuota(input) {
    await executor.execute(upsertStorageQuotaStatement(input));
  },
  async getStorageQuota(instanceId) {
    const result = await executor.execute<MediaStorageQuotaRow>(
      getStorageQuotaStatement(instanceId)
    );
    return result.rows[0] ? mapStorageQuotaRow(result.rows[0]) : null;
  },
  async wouldExceedStorageQuota(instanceId, additionalBytes) {
    const [quota, usage] = await Promise.all([
      this.getStorageQuota(instanceId),
      this.getStorageUsage(instanceId),
    ]);
    const currentBytes = usage?.totalBytes ?? 0;
    const maxBytes = quota?.maxBytes ?? null;
    return {
      instanceId,
      currentBytes,
      additionalBytes,
      maxBytes,
      wouldExceed: maxBytes === null ? false : currentBytes + additionalBytes > maxBytes,
    };
  },
});
