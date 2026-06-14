import { describe, expect, it } from 'vitest';

import type { MailDispatchPayload, WasteManagementEmailReminderConfig } from '@sva/core';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createWasteEmailReminderRepository } from './email-reminders.js';

const createExecutor = () => {
  const statements: SqlStatement[] = [];
  const queuedResults: SqlExecutionResult[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const nextResult = queuedResults.shift();
      return (nextResult ?? {
        rowCount: 0,
        rows: [],
      }) as SqlExecutionResult<TRow>;
    },
  };

  return { executor, statements, queuedResults };
};

const reminderConfig: WasteManagementEmailReminderConfig = {
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'mail-transport-1',
  publicBaseUrl: 'https://demo.abfallkalender.example',
  doiConfirmPath: '/email-reminders/confirm',
  unsubscribePath: '/email-reminders/unsubscribe',
  fromName: 'Abfallwirtschaft',
  fromEmail: 'abfall@example.org',
  privacyPolicyUrl: 'https://demo.abfallkalender.example/datenschutz',
  imprintUrl: 'https://demo.abfallkalender.example/impressum',
  consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
  consentVersion: 'v1',
  doiSubjectTemplate: 'Bitte E-Mail-Adresse bestätigen',
  doiIntroText: 'Klicken Sie auf den Link.',
  doiButtonLabel: 'Bestätigen',
  reminderSubjectTemplate: 'Erinnerung',
  reminderIntroTemplate: 'Nicht vergessen.',
  unsubscribeLinkLabel: 'Abmelden',
  unsubscribeSuccessHeadline: 'Abmeldung erfolgreich',
  unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
  maxSubscriptionsPerEmailAndLocation: 3,
  signupRateLimitPerIpPerHour: 10,
  signupRateLimitPerEmailPerHour: 3,
  doiTokenTtlHours: 24,
  pendingSubscriptionTtlHours: 48,
  materializationLookaheadDays: 7,
};

describe('waste email reminder repository', () => {
  it('persists a pending subscription, items, and a DOI outbox job', async () => {
    const { executor, statements } = createExecutor();
    const repository = createWasteEmailReminderRepository(executor);
    const mailDispatch: MailDispatchPayload = {
      orderId: 'dispatch-1',
      transportId: 'mail-transport-1',
      messageKind: 'transactional',
      templateKey: 'waste.email-reminder.doi',
      addresses: [{ kind: 'to', email: 'person@example.org' }],
      templatePayload: {
        confirmUrl: 'https://demo.abfallkalender.example/email-reminders/confirm?token=abc',
        locationLabel: 'Perleberg, Ackerstr. 12',
      },
      metadata: {
        module: 'waste-management',
        flow: 'double-opt-in',
      },
    };

    await repository.createPendingSignup({
      subscriptionId: '11111111-1111-4111-8111-111111111111',
      email: 'person@example.org',
      emailHash: 'sha256:email',
      selection: {
        cityId: '22222222-2222-4222-8222-222222222222',
        streetId: '33333333-3333-4333-8333-333333333333',
        houseNumberId: '44444444-4444-4444-8444-444444444444',
      },
      locationLabel: 'Perleberg, Ackerstr. 12',
      consentVersion: reminderConfig.consentVersion,
      consentAcceptedAt: '2026-06-14T19:00:00.000Z',
      doiTokenHash: 'sha256:doi',
      unsubscribeTokenHash: 'sha256:unsubscribe',
      expiresAt: '2026-06-16T19:00:00.000Z',
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          fractionId: '66666666-6666-4666-8666-666666666666',
          slotId: 'bio:first',
        },
      ],
      outbox: {
        id: '77777777-7777-4777-8777-777777777777',
        transportId: reminderConfig.transportId,
        templateKey: 'waste.email-reminder.doi',
        sendAt: '2026-06-14T19:00:00.000Z',
        dedupeKey: 'doi:11111111-1111-4111-8111-111111111111',
        payload: mailDispatch,
      },
    });

    expect(statements).toHaveLength(3);
    expect(statements[0]?.text).toContain('INSERT INTO waste_email_reminder_subscriptions');
    expect(statements[0]?.values).toContain('person@example.org');
    expect(statements[0]?.values).toContain('sha256:doi');
    expect(statements[1]?.text).toContain('INSERT INTO waste_email_reminder_subscription_items');
    expect(statements[1]?.values).toContain('bio:first');
    expect(statements[2]?.text).toContain('INSERT INTO waste_email_reminder_outbox');
    expect(statements[2]?.values).toContain('doi:11111111-1111-4111-8111-111111111111');
    expect(statements[2]?.values).toContain(JSON.stringify(mailDispatch));
  });

  it('counts active and pending subscriptions for the same email and location', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 1,
      rows: [{ total: 2 }],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(
      repository.countSubscriptionsForEmailLocation({
        emailHash: 'sha256:email',
        selection: {
          cityId: '22222222-2222-4222-8222-222222222222',
          streetId: '33333333-3333-4333-8333-333333333333',
          houseNumberId: '44444444-4444-4444-8444-444444444444',
        },
      })
    ).resolves.toBe(2);

    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain('COUNT(*)::int AS total');
    expect(statements[0]?.values).toContain('sha256:email');
  });

  it('lists active subscriptions with grouped items', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 2,
      rows: [
        {
          subscription_id: 'sub-1',
          email: 'person@example.org',
          location_label: 'Perleberg, Ackerstr. 12',
          region_id: null,
          city_id: 'city-1',
          street_id: 'street-1',
          house_number_id: 'house-1',
          unsubscribe_token_hash: 'sha256:unsubscribe',
          fraction_id: 'fraction-1',
          slot_id: 'bio:first',
        },
        {
          subscription_id: 'sub-1',
          email: 'person@example.org',
          location_label: 'Perleberg, Ackerstr. 12',
          region_id: null,
          city_id: 'city-1',
          street_id: 'street-1',
          house_number_id: 'house-1',
          unsubscribe_token_hash: 'sha256:unsubscribe',
          fraction_id: 'fraction-2',
          slot_id: 'paper:second',
        },
      ],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(repository.listActiveSubscriptions()).resolves.toEqual([
      {
        id: 'sub-1',
        email: 'person@example.org',
        locationLabel: 'Perleberg, Ackerstr. 12',
        cityId: 'city-1',
        streetId: 'street-1',
        houseNumberId: 'house-1',
        unsubscribeTokenHash: 'sha256:unsubscribe',
        items: [
          { fractionId: 'fraction-1', slotId: 'bio:first' },
          { fractionId: 'fraction-2', slotId: 'paper:second' },
        ],
      },
    ]);

    expect(statements[0]?.text).toContain("WHERE s.status = 'active'");
  });

  it('leases and updates outbox entries for batch processing', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 1,
      rows: [
        {
          id: 'outbox-1',
          subscription_id: 'sub-1',
          message_kind: 'reminder',
          transport_id: 'mail-transport-1',
          template_key: 'waste.email-reminder.reminder',
          dedupe_key: 'reminder:sub-1:fraction-1:bio:first:2026-06-20',
          attempt_count: 1,
          payload: JSON.stringify({
            orderId: 'sub-1',
            transportId: 'mail-transport-1',
            messageKind: 'transactional',
            templateKey: 'waste.email-reminder.reminder',
            addresses: [{ kind: 'to', email: 'person@example.org' }],
            templatePayload: { subject: 'Nicht vergessen' },
          }),
        },
      ],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(
      repository.leaseDueOutboxEntries({
        now: '2026-06-14T19:00:00.000Z',
        limit: 10,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'outbox-1',
        messageKind: 'reminder',
        transportId: 'mail-transport-1',
        attemptCount: 1,
      }),
    ]);

    await repository.markOutboxEntrySent({
      outboxId: 'outbox-1',
      now: '2026-06-14T19:05:00.000Z',
      providerMessageId: 'provider-1',
    });

    await repository.markOutboxEntryFailed({
      outboxId: 'outbox-2',
      now: '2026-06-14T19:10:00.000Z',
      errorMessage: 'smtp_down',
      retryAt: '2026-06-14T19:25:00.000Z',
    });

    expect(statements[0]?.text).toContain('FOR UPDATE SKIP LOCKED');
    expect(statements[1]?.text).toContain("SET status = 'sent'");
    expect(statements[2]?.text).toContain("CASE WHEN $4::timestamptz IS NULL THEN 'failed' ELSE 'pending' END");
  });

  it('activates a pending subscription for a valid DOI token hash', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 1,
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'pending',
          location_label: 'Perleberg, Ackerstr. 12',
          expires_at: '2026-06-16T19:00:00.000Z',
        },
      ],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(
      repository.activateByDoiTokenHash({
        tokenHash: 'sha256:doi',
        now: '2026-06-14T19:00:00.000Z',
      })
    ).resolves.toEqual({
      status: 'activated',
      subscriptionId: '11111111-1111-4111-8111-111111111111',
      locationLabel: 'Perleberg, Ackerstr. 12',
    });

    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain('WHERE doi_token_hash = $1');
    expect(statements[1]?.text).toContain("SET status = 'active'");
  });

  it('returns expired for an outdated pending DOI token hash', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 1,
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'pending',
          location_label: 'Perleberg, Ackerstr. 12',
          expires_at: '2026-06-13T19:00:00.000Z',
        },
      ],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(
      repository.activateByDoiTokenHash({
        tokenHash: 'sha256:doi',
        now: '2026-06-14T19:00:00.000Z',
      })
    ).resolves.toEqual({
      status: 'expired',
    });

    expect(statements).toHaveLength(1);
  });

  it('unsubscribes an active subscription for a valid token hash', async () => {
    const { executor, statements, queuedResults } = createExecutor();
    queuedResults.push({
      rowCount: 1,
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'active',
          location_label: 'Perleberg, Ackerstr. 12',
          expires_at: '2026-06-16T19:00:00.000Z',
        },
      ],
    });
    const repository = createWasteEmailReminderRepository(executor);

    await expect(
      repository.unsubscribeByTokenHash({
        tokenHash: 'sha256:unsubscribe',
        now: '2026-06-14T19:00:00.000Z',
      })
    ).resolves.toEqual({
      status: 'unsubscribed',
      subscriptionId: '11111111-1111-4111-8111-111111111111',
      locationLabel: 'Perleberg, Ackerstr. 12',
    });

    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain('WHERE unsubscribe_token_hash = $1');
    expect(statements[1]?.text).toContain("SET status = 'unsubscribed'");
  });
});
