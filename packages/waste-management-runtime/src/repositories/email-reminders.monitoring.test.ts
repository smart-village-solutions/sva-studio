import { describe, expect, it, vi } from 'vitest';
import {
  loadWasteEmailMonitoring,
  maskWasteEmail,
  classifyWasteEmailError,
} from './email-reminders.monitoring.js';
import type { SqlExecutor } from '@sva/data-repositories';

describe('email monitoring privacy projection', () => {
  it.each([
    ['philipp@example.de', 'p*****p@e********e'],
    ['ab@cd', '**@**'],
    ['a@b', '*@*'],
    ['abc@def', 'a*c@d*f'],
    ['bad', '***@***'],
    ['a@b@c', '***@***'],
  ])('masks %s on the server', (value, expected) => expect(maskWasteEmail(value)).toBe(expected));

  it.each(['subscription_unsubscribed', 'doi_token_expired', 'reminder_no_longer_applicable'])(
    'classifies the persisted cancellation reason %s without reporting a transport failure',
    (reason) => expect(classifyWasteEmailError(reason)).toBe('cancelled')
  );

  it('does not expose provider errors or message references as error text', () => {
    expect(classifyWasteEmailError('smtp failure for private@example.test token=secret')).toBe(
      'dispatch_failed'
    );
    expect(classifyWasteEmailError('provider_message_id:private@example.test')).toBeNull();
  });

  it('returns only masked recipients and safe delivery fields with bounded parameterized queries', async () => {
    const results = [
      [{ total: 1, activeTotal: 2 }],
      [
        {
          id: 'sub',
          email: 'philipp@example.de',
          status: 'active',
          city: 'Testort',
          createdAt: '',
          activatedAt: null,
          unsubscribedAt: null,
          items: [],
          doiEmail: { status: 'failed', sentAt: null },
          lastSentEmail: { kind: 'reminder', sentAt: '2026-11-17T10:00:00.000Z' },
        },
      ],
      [{ total: 1 }],
      [
        {
          id: 'mail',
          kind: 'doi',
          status: 'failed',
          createdAt: '',
          scheduledAt: '',
          sentAt: null,
          attempts: 2,
          fraction: null,
          pickupDate: null,
          lastError: 'smtp private@example.test token=secret',
        },
      ],
    ];
    const execute = vi.fn(async () => ({ rowCount: 1, rows: results.shift() ?? [] }));
    const data = await loadWasteEmailMonitoring({ execute } as SqlExecutor, {
      page: 2,
      pageSize: 25,
      deliveryPage: 1,
      status: 'active',
      subscriptionId: 'sub',
    });
    expect(data.subscriptions[0]?.maskedEmail).toBe('p*****p@e********e');
    expect(data.subscriptions[0]?.doiEmail).toEqual({ status: 'failed', sentAt: null });
    expect(data.subscriptions[0]?.lastSentEmail?.kind).toBe('reminder');
    expect(data).toMatchObject({ total: 1, activeTotal: 2 });
    expect(data.deliveries[0]?.error).toBe('dispatch_failed');
    expect(JSON.stringify(data)).not.toMatch(/philipp|private|secret|lastError/);
    const calls = execute.mock.calls as unknown as [{ text: string; values: unknown[] }][];
    expect(calls[1]?.[0].values).toEqual(['active', 25, 25]);
    expect(calls[0]?.[0].text).toContain("FILTER (WHERE status = 'active')");
    expect(calls[1]?.[0].text).toContain("message_kind = 'doi'");
    expect(calls[3]?.[0].values).toEqual(['sub', 25, 0]);
    expect(calls[3]?.[0].text).not.toContain('SELECT payload');
  });
});
