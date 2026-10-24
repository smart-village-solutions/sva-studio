import type { VoucherQuota } from './vouchers.types.js';
export type VoucherUsage =
  | Readonly<{
      status: 'unavailable' | 'inconsistent';
    }>
  | Readonly<{
      status: 'available';
      used: number;
      remaining: number;
      maximum: number;
      percentage?: number;
      overflow?: number;
    }>;
export const getVoucherUsage = (quota: VoucherQuota | null): VoucherUsage => {
  if (!quota || quota.maxQuantity === null || quota.availableQuantity === null)
    return { status: 'unavailable' };
  const maximum = quota.maxQuantity;
  const remaining = quota.availableQuantity;
  if (
    !Number.isSafeInteger(maximum) ||
    !Number.isSafeInteger(remaining) ||
    maximum < 0 ||
    remaining > maximum
  ) {
    return { status: 'inconsistent' };
  }
  const used = maximum - remaining;
  return {
    status: 'available',
    used,
    remaining,
    maximum,
    ...(maximum > 0 ? { percentage: Math.round((used / maximum) * 1000) / 10 } : {}),
    ...(remaining < 0 ? { overflow: -remaining } : {}),
  };
};
