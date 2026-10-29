import { usePluginTranslation } from '@sva/plugin-sdk';
import type { VoucherQuota } from './vouchers.types.js';
import { getVoucherUsage } from './vouchers.usage.js';
export function VoucherUsageView({
  quota,
  compact = false,
  fetchedAt,
}: Readonly<{
  quota: VoucherQuota | null;
  compact?: boolean;
  fetchedAt?: string;
}>) {
  const t = usePluginTranslation('vouchers');
  const usage = getVoucherUsage(quota);
  if (usage.status !== 'available') return <p role="status">{t(`usage.${usage.status}`)}</p>;
  const frequency = quota?.frequency;
  const knownPeriod = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(
    frequency ?? ''
  );
  return (
    <div className="space-y-2">
      {!compact && <h2 className="text-lg font-semibold">{t('usage.title')}</h2>}
      <p className="text-sm text-muted-foreground">{t('usage.registered')}</p>
      <p className={compact ? 'text-sm font-medium' : 'text-2xl font-semibold'}>
        {t('usage.used', { used: usage.used, maximum: usage.maximum })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('usage.remaining', { remaining: usage.remaining })}
      </p>
      {usage.percentage !== undefined && (
        <>
          <progress
            className="h-2 w-full accent-primary"
            max={100}
            value={Math.min(usage.percentage, 100)}
            aria-label={t('usage.percent', { percentage: usage.percentage })}
          />
          {!compact && <p>{t('usage.percent', { percentage: usage.percentage })}</p>}
        </>
      )}
      <p className="text-sm">{t(`usage.period.${knownPeriod ? frequency : 'unknown'}`)}</p>
      {usage.overflow && <p role="status">{t('usage.overdrawn', { overflow: usage.overflow })}</p>}
      {!compact && (
        <>
          {usage.used === 0 && <p>{t('usage.empty')}</p>}
          {usage.remaining === 0 && <p>{t('usage.exhausted')}</p>}
          {quota?.maxPerPerson != null && (
            <p>{t('usage.person', { maximum: quota.maxPerPerson })}</p>
          )}
          {fetchedAt && (
            <p className="text-xs text-muted-foreground">
              {t('usage.fetched', { date: new Date(fetchedAt).toLocaleString() })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t('usage.notice')}</p>
        </>
      )}
    </div>
  );
}
