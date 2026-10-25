import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { VoucherUsageView } from '../src/vouchers.usage-view.js';
import { afterEach, describe, expect, it } from 'vitest';
import { getVoucherUsage } from '../src/vouchers.usage.js';
describe('registered voucher usage', () => {
  it.each([
    [63, 37, 37],
    [100, 0, 0],
    [0, 100, 100],
    [-2, 102, 102],
  ])('maps remaining %s honestly', (remaining, used, percentage) => {
    expect(
      getVoucherUsage({
        maxQuantity: 100,
        availableQuantity: remaining,
        frequency: 'monthly',
        maxPerPerson: 1,
      })
    ).toMatchObject({ status: 'available', used, remaining, percentage });
  });
  it('does not mistake missing or contradictory data for zero usage', () => {
    expect(getVoucherUsage(null).status).toBe('unavailable');
    expect(
      getVoucherUsage({
        maxQuantity: 10,
        availableQuantity: 11,
        frequency: 'once',
        maxPerPerson: null,
      }).status
    ).toBe('inconsistent');
  });
  it('does not divide by zero', () => {
    expect(
      getVoucherUsage({
        maxQuantity: 0,
        availableQuantity: 0,
        frequency: 'once',
        maxPerPerson: null,
      }).percentage
    ).toBeUndefined();
  });
});

afterEach(cleanup);
describe('usage presentation', () => {
  it.each([
    [100, 'vouchers.usage.empty'],
    [0, 'vouchers.usage.exhausted'],
    [-2, 'vouchers.usage.overdrawn'],
  ])('labels remaining %s without hiding period or overflow', (remaining, label) => {
    render(
      createElement(VoucherUsageView, {
        quota: {
          maxQuantity: 100,
          availableQuantity: Number(remaining),
          frequency: 'unexpected',
          maxPerPerson: null,
        },
      })
    );
    expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByText('vouchers.usage.period.unknown')).toBeDefined();
    expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(
      Math.min(100, 100 - Number(remaining))
    );
  });
  it('shows missing quota as unavailable without fabricated zero or percentage', () => {
    render(createElement(VoucherUsageView, { quota: null }));
    expect(screen.getByText('vouchers.usage.unavailable')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('shows inconsistent server values without a progress bar', () => {
    render(
      createElement(VoucherUsageView, {
        quota: { maxQuantity: 10, availableQuantity: 11, maxPerPerson: null, frequency: null },
      })
    );
    expect(screen.getByText('vouchers.usage.inconsistent')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('represents a zero-sized quota without a percentage', () => {
    render(
      createElement(VoucherUsageView, {
        quota: { maxQuantity: 0, availableQuantity: 0, maxPerPerson: null, frequency: 'once' },
      })
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
