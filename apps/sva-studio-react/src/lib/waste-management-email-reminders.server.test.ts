import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';
import { protectField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import type { SqlClient, WasteOperationSqlPool } from './waste-management-operations.types.js';
import {
  readPublicWasteUnsubscribeTokenSubscriptionId,
  verifyPublicWasteUnsubscribeToken,
} from '../../../public-waste-calendar-web/src/server/public-waste-unsubscribe-token.server.js';

const createOrUpdateSvaMainserverStaticContentMock = vi.hoisted(() => vi.fn());
const runWasteManagementMainserverSyncForInstanceMock = vi.hoisted(() => vi.fn());

const createInterfaceRecord = (schemaName = 'wm'): ExternalInterfaceRecord => ({
  id: 'iface-1',
  instanceId: 'instance-1',
  typeKey: 'supabase' as const,
  ownerKind: 'host' as const,
  ownerId: 'host',
  displayName: 'Waste Supabase',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database' as const,
  baseUrl: 'https://tenant.supabase.co',
  authMode: 'service_role',
  publicConfig: {
    projectUrl: 'https://tenant.supabase.co',
    schemaName,
  },
  secretConfigCiphertext: 'cipher-secret',
  statusCheckKind: 'supabase' as const,
  visibleStatus: 'ok' as const,
  lastCheckStatus: 'succeeded' as const,
  lastCheckedAt: '2026-05-10T10:00:00.000Z',
  updatedAt: '2026-05-10T10:00:00.000Z',
});

const revealSupabaseSecretConfig = (ciphertext: string | null | undefined): string | undefined =>
  ciphertext
    ? JSON.stringify({
        databaseUrl: 'postgres://waste:test@localhost:5432/waste',
        serviceRoleKey: 'service-key',
      })
    : undefined;

describe('waste management operations runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@sva/server-runtime');
    vi.doUnmock('@sva/data-repositories');
    vi.doUnmock('@sva/sva-mainserver/server');
    vi.doUnmock('./waste-management-operations.import.js');
    vi.doUnmock('./waste-management-mainserver-sync.materialization.js');
    vi.doMock('./waste-management-mainserver-sync.server.js', () => ({
      runWasteManagementMainserverSyncForInstance: runWasteManagementMainserverSyncForInstanceMock,
    }));
    createOrUpdateSvaMainserverStaticContentMock.mockReset();
    runWasteManagementMainserverSyncForInstanceMock.mockReset();
  });

  it('renders reminder outbox entries into dispatchable mails', async () => {
    const dispatchMail = vi.fn(async () => ({
      providerMessageId: 'provider-1',
    }));
    const leaseDueOutboxEntries = vi.fn(async () => [
      {
        id: 'outbox-1',
        subscriptionId: 'subscription-1',
        messageKind: 'reminder',
        transportId: 'transport-smtp',
        templateKey: 'waste.email-reminder.reminder',
        sendAt: '2026-06-15T06:00:00.000Z',
        dedupeKey: 'dedupe-1',
        attemptCount: 0,
        payload: {
          orderId: 'subscription-1',
          transportId: 'transport-smtp',
          messageKind: 'transactional',
          templateKey: 'waste.email-reminder.reminder',
          locale: 'de-DE',
          addresses: [
            {
              kind: 'to',
              email: 'max@example.org',
            },
            {
              kind: 'reply_to',
              email: 'abfall@example.org',
            },
          ],
          templatePayload: {
            subject: 'Abfalltermine für Perleberg (Ackerstraße)',
            introText: 'Nicht vergessen: Di. 16.06.',
            listIntroText: 'Folgende Fraktion wird abgeholt:',
            outroText: 'Mit freundlichen Grüßen\nIhr Mülli',
            reasonText: 'Sie erhalten diese Nachricht, weil Sie eine Erinnerung eingerichtet haben.',
            unsubscribeLabel: 'E-Mail-Erinnerung abbestellen',
            unsubscribeUrl: 'https://demo.abfallkalender.example/erinnerungen/abmelden?token=sha256:abc',
            locationLabel: 'Perleberg (Ackerstraße)',
            pickupDate: 'Di., 16.06.',
            fractionName: 'Papier, Pappe, Kartonagen',
            privacyPolicyUrl: 'https://demo.abfallkalender.example/datenschutz',
            imprintUrl: 'https://demo.abfallkalender.example/impressum',
            serviceLabel: 'Landkreis Prignitz',
          },
          tags: ['waste-management', 'email-reminder', 'reminder'],
          metadata: {
            module: 'waste-management',
            flow: 'public-email-reminder-delivery',
          },
        },
        providerMessageId: null,
        lastErrorMessage: null,
        sentAt: null,
        retryAt: null,
        lockedAt: '2026-06-15T06:00:00.000Z',
        createdAt: '2026-06-14T06:00:00.000Z',
        updatedAt: '2026-06-14T06:00:00.000Z',
      },
    ]);
    const markOutboxEntrySent = vi.fn(async () => undefined);
    const reminderRepository = {
      leaseDueOutboxEntries,
      markOutboxEntrySent,
      markOutboxEntryFailed: vi.fn(async () => undefined),
    };

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        createInterfaceRecordWithEmailReminderConfig(),
        createMailTransportInterfaceRecord(),
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      dispatchMail,
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.processEmailReminderOutbox('instance-1', {
      operation: 'process-email-reminder-outbox',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(dispatchMail).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      transport: expect.objectContaining({
        transportId: 'transport-smtp',
        transportType: 'smtp',
      }),
      payload: expect.objectContaining({
        templateKey: 'waste.email-reminder.reminder',
      }),
      message: {
        from: {
          email: 'noreply@abfallkalender.example',
          displayName: 'Ihr Mülli',
        },
        to: [{ email: 'max@example.org' }],
        replyTo: [{ email: 'abfall@example.org' }],
        subject: 'Abfalltermine für Perleberg (Ackerstraße)',
        text: [
          'Nicht vergessen: Di. 16.06.',
          'Folgende Fraktion wird abgeholt:',
          '- Papier, Pappe, Kartonagen (Di., 16.06.)',
          'Mit freundlichen Grüßen\nIhr Mülli',
          'Sie erhalten diese Nachricht, weil Sie eine Erinnerung eingerichtet haben.',
          'E-Mail-Erinnerung abbestellen: https://demo.abfallkalender.example/erinnerungen/abmelden?token=sha256:abc',
          'Datenschutz: https://demo.abfallkalender.example/datenschutz',
          'Impressum: https://demo.abfallkalender.example/impressum',
          'Service: Landkreis Prignitz',
        ].join('\n\n'),
      },
    });
    expect(markOutboxEntrySent).toHaveBeenCalledWith({
      outboxId: 'outbox-1',
      now: '2026-06-15T06:00:00.000Z',
      providerMessageId: 'provider-1',
    });
    expect(result.details).toMatchObject({
      operation: 'process-email-reminder-outbox',
      mode: 'executed',
      leasedCount: 1,
      sentCount: 1,
      retryScheduledCount: 0,
      failedCount: 0,
    });
  });

  it('skips outbox processing when email reminders are disabled for the selected interface', async () => {
    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        {
          ...createInterfaceRecordWithEmailReminderConfig(),
          publicConfig: {
            ...createInterfaceRecordWithEmailReminderConfig().publicConfig,
            emailReminderConfig: {
              ...createWasteEmailReminderConfig(),
              enabled: false,
            },
          },
        },
      ]),
      dispatchMail: vi.fn(),
    });

    await expect(
      runtime.processEmailReminderOutbox('instance-1', {
        operation: 'process-email-reminder-outbox',
      })
    ).resolves.toMatchObject({
      details: {
        operation: 'process-email-reminder-outbox',
        mode: 'skipped',
        reason: 'email_reminders_disabled',
        batchSize: 0,
      },
    });
  });

  it('rejects invalid outbox reference times and unavailable transports before leasing entries', async () => {
    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      dispatchMail: vi.fn(),
    });

    await expect(
      runtime.processEmailReminderOutbox('instance-1', {
        operation: 'process-email-reminder-outbox',
        referenceTime: 'not-a-date',
      })
    ).rejects.toThrowError('invalid_reference_time:not-a-date');

    await expect(
      runtime.processEmailReminderOutbox('instance-1', {
        operation: 'process-email-reminder-outbox',
        referenceTime: '2026-06-15T06:00:00.000Z',
      })
    ).rejects.toThrowError('mail_transport_not_available:transport-smtp');
  });

  it('marks failed outbox entries with retry or terminal failure depending on attempt count', async () => {
    const markOutboxEntryFailed = vi.fn(
      async (_input: { readonly outboxId: string; readonly errorMessage: string; readonly retryAt?: string }) => undefined
    );
    const reminderRepository = {
      leaseDueOutboxEntries: vi.fn(async () => [
        {
          id: 'outbox-retry',
          transportId: 'transport-smtp',
          attemptCount: 0,
          payload: {
            transportId: 'transport-smtp',
            templateKey: 'waste.email-reminder.reminder',
            locale: 'de-DE',
            addresses: [{ kind: 'to', email: 'max@example.org' }],
            templatePayload: {
              subject: 'Abfalltermine',
              introText: 'Nicht vergessen',
              listIntroText: 'Liste',
              outroText: 'Gruß',
              reasonText: 'Grund',
              unsubscribeLabel: 'Abmelden',
              unsubscribeUrl: 'https://example.org/unsubscribe',
              locationLabel: 'Perleberg',
              pickupDate: 'Di., 16.06.',
              fractionName: 'Papier',
              privacyPolicyUrl: 'https://example.org/privacy',
              imprintUrl: 'https://example.org/imprint',
              serviceLabel: 'Landkreis Prignitz',
            },
            tags: [],
            metadata: {},
          },
        },
        {
          id: 'outbox-failed',
          transportId: 'transport-smtp',
          attemptCount: 1,
          payload: {
            transportId: 'transport-smtp',
            templateKey: 'waste.email-reminder.reminder',
            locale: 'de-DE',
            addresses: [{ kind: 'to', email: 'max@example.org' }],
            templatePayload: {
              subject: 'Abfalltermine',
              introText: 'Nicht vergessen',
              listIntroText: 'Liste',
              outroText: 'Gruß',
              reasonText: 'Grund',
              unsubscribeLabel: 'Abmelden',
              unsubscribeUrl: 'https://example.org/unsubscribe',
              locationLabel: 'Perleberg',
              pickupDate: 'Di., 16.06.',
              fractionName: 'Papier',
              privacyPolicyUrl: 'https://example.org/privacy',
              imprintUrl: 'https://example.org/imprint',
              serviceLabel: 'Landkreis Prignitz',
            },
            tags: [],
            metadata: {},
          },
        },
      ]),
      markOutboxEntrySent: vi.fn(async () => undefined),
      markOutboxEntryFailed,
    };

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        createInterfaceRecordWithEmailReminderConfig(),
        createMailTransportInterfaceRecord(),
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      dispatchMail: vi.fn(async () => {
        throw new Error('smtp_unavailable');
      }),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.processEmailReminderOutbox('instance-1', {
      operation: 'process-email-reminder-outbox',
      referenceTime: '2026-06-15T06:00:00.000Z',
      maxAttempts: 1,
      retryDelayMinutes: 10,
    });

    expect(markOutboxEntryFailed).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        outboxId: 'outbox-retry',
        errorMessage: 'smtp_unavailable',
        retryAt: '2026-06-15T06:10:00.000Z',
      })
    );
    expect(markOutboxEntryFailed).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        outboxId: 'outbox-failed',
        errorMessage: 'smtp_unavailable',
      })
    );
    expect(markOutboxEntryFailed.mock.calls[1]?.[0]).not.toHaveProperty('retryAt');
    expect(result.details).toMatchObject({
      operation: 'process-email-reminder-outbox',
      leasedCount: 2,
      sentCount: 0,
      retryScheduledCount: 1,
      failedCount: 1,
    });
  });

  it('caps outbox leasing by the transport rate limit per minute', async () => {
    const leaseDueOutboxEntries = vi.fn(async () => []);
    const reminderRepository = {
      leaseDueOutboxEntries,
      markOutboxEntrySent: vi.fn(async () => undefined),
      markOutboxEntryFailed: vi.fn(async () => undefined),
    };

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        createInterfaceRecordWithEmailReminderConfig(),
        {
          ...createMailTransportInterfaceRecord(),
          publicConfig: {
            ...createMailTransportInterfaceRecord().publicConfig,
            maxBatchSize: 25,
            rateLimitPerMinute: 3,
          },
        },
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      dispatchMail: vi.fn(),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.processEmailReminderOutbox('instance-1', {
      operation: 'process-email-reminder-outbox',
      referenceTime: '2026-06-15T06:00:00.000Z',
      maxBatchSize: 10,
    });

    expect(leaseDueOutboxEntries).toHaveBeenCalledWith({
      now: '2026-06-15T06:00:00.000Z',
      limit: 3,
    });
    expect(result.details).toMatchObject({
      operation: 'process-email-reminder-outbox',
      batchSize: 3,
      leasedCount: 0,
    });
  });

  it('dispatches each leased outbox entry through its recorded transport id', async () => {
    const dispatchMail = vi.fn(async () => ({
      providerMessageId: 'provider-2',
    }));
    const leaseDueOutboxEntries = vi.fn(async () => [
      {
        id: 'outbox-legacy-transport',
        subscriptionId: 'subscription-1',
        messageKind: 'reminder',
        transportId: 'transport-smtp-legacy',
        templateKey: 'waste.email-reminder.reminder',
        sendAt: '2026-06-15T06:00:00.000Z',
        dedupeKey: 'dedupe-legacy',
        attemptCount: 0,
        payload: {
          orderId: 'subscription-1',
          transportId: 'transport-smtp-legacy',
          messageKind: 'transactional',
          templateKey: 'waste.email-reminder.reminder',
          locale: 'de-DE',
          addresses: [{ kind: 'to', email: 'max@example.org' }],
          templatePayload: {
            subject: 'Abfalltermine',
            introText: 'Nicht vergessen',
            listIntroText: 'Liste',
            outroText: 'Gruß',
            reasonText: 'Grund',
            unsubscribeLabel: 'Abmelden',
            unsubscribeUrl: 'https://example.org/unsubscribe',
            locationLabel: 'Perleberg',
            pickupDate: 'Di., 16.06.',
            fractionName: 'Papier',
            privacyPolicyUrl: 'https://example.org/privacy',
            imprintUrl: 'https://example.org/imprint',
            serviceLabel: 'Landkreis Prignitz',
          },
          tags: [],
          metadata: {},
        },
        providerMessageId: null,
        lastErrorMessage: null,
        sentAt: null,
        retryAt: null,
        lockedAt: '2026-06-15T06:00:00.000Z',
        createdAt: '2026-06-14T06:00:00.000Z',
        updatedAt: '2026-06-14T06:00:00.000Z',
      },
    ]);
    const markOutboxEntrySent = vi.fn(async () => undefined);
    const reminderRepository = {
      leaseDueOutboxEntries,
      markOutboxEntrySent,
      markOutboxEntryFailed: vi.fn(async () => undefined),
    };

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        {
          ...createInterfaceRecordWithEmailReminderConfig(),
          publicConfig: {
            ...createInterfaceRecordWithEmailReminderConfig().publicConfig,
            emailReminderConfig: {
              ...createWasteEmailReminderConfig(),
              transportId: 'transport-smtp-current',
            },
          },
        },
        createMailTransportInterfaceRecord({
          transportId: 'transport-smtp-current',
          alias: 'smtp-current',
          host: 'mail-current.example.org',
        }),
        createMailTransportInterfaceRecord({
          id: 'mail-transport-legacy',
          transportId: 'transport-smtp-legacy',
          alias: 'smtp-legacy',
          host: 'mail-legacy.example.org',
        }),
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      dispatchMail,
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.processEmailReminderOutbox('instance-1', {
      operation: 'process-email-reminder-outbox',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(dispatchMail).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.objectContaining({
          transportId: 'transport-smtp-legacy',
          host: 'mail-legacy.example.org',
        }),
        payload: expect.objectContaining({
          transportId: 'transport-smtp-legacy',
        }),
      })
    );
    expect(markOutboxEntrySent).toHaveBeenCalledWith({
      outboxId: 'outbox-legacy-transport',
      now: '2026-06-15T06:00:00.000Z',
      providerMessageId: 'provider-2',
    });
    expect(result.details).toMatchObject({
      operation: 'process-email-reminder-outbox',
      leasedCount: 1,
      sentCount: 1,
    });
  });

  it('materializes reminders for explicit assignments even when public signup is disabled', async () => {
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-1',
          email: 'max@example.org',
          locationLabel: 'Perleberg, Ackerstraße 1',
          cityId: 'city-1',
          streetId: 'street-1',
          unsubscribeTokenHash: 'sha256:unsubscribe',
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => []),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourAssignments: vi.fn(async () => [
        {
          id: 'assignment-1',
          tourId: 'tour-1',
          pickupDate: '2026-06-16',
          locationIds: ['location-1'],
          note: undefined,
        },
      ]),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        {
          ...createInterfaceRecordWithEmailReminderConfig(),
          publicConfig: {
            ...createInterfaceRecordWithEmailReminderConfig().publicConfig,
            emailReminderConfig: {
              ...createWasteEmailReminderConfig(),
              publicSignupEnabled: false,
            },
          },
        },
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 1,
    });
  });

  it('matches region-scoped subscriptions against legacy locations without a region id', async () => {
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-region-1',
          email: 'max@example.org',
          locationLabel: 'Perleberg, Ackerstraße 1',
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          unsubscribeTokenHash: 'sha256:unsubscribe',
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [
        { id: 'link-1', locationId: 'location-legacy', tourId: 'tour-1', active: true },
      ]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-legacy',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => [
        { id: 'pickup-1', locationId: 'location-legacy', tourId: 'tour-1', pickupDate: '2026-06-16' },
      ]),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 1,
      skippedPickupCount: 0,
    });
  });

  it('does not enqueue reminder outbox entries whose send time is already in the past', async () => {
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-1',
          email: 'max@example.org',
          locationLabel: 'Perleberg, Ackerstraße 1',
          cityId: 'city-1',
          streetId: 'street-1',
          unsubscribeTokenHash: 'sha256:unsubscribe',
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true }]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => [{ id: 'pickup-1', locationId: 'location-1', tourId: 'tour-1', pickupDate: '2026-06-10' }]),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 0,
      duplicateOutboxCount: 0,
    });
  });

  it('skips reminder materialization entirely when email reminders are disabled', async () => {
    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [
        {
          ...createInterfaceRecordWithEmailReminderConfig(),
          publicConfig: {
            ...createInterfaceRecordWithEmailReminderConfig().publicConfig,
            emailReminderConfig: {
              ...createWasteEmailReminderConfig(),
              enabled: false,
            },
          },
        },
      ]),
    });

    await expect(
      runtime.materializeEmailReminders('instance-1', {
        operation: 'materialize-email-reminders',
      })
    ).resolves.toMatchObject({
      details: {
        operation: 'materialize-email-reminders',
        mode: 'skipped',
        reason: 'email_reminders_disabled',
        activeSubscriptionCount: 0,
      },
    });
  });

  it('rejects invalid reference times before materializing reminder outbox entries', async () => {
    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
    });

    await expect(
      runtime.materializeEmailReminders('instance-1', {
        operation: 'materialize-email-reminders',
        referenceTime: 'not-a-date',
      })
    ).rejects.toThrowError('invalid_reference_time:not-a-date');
  });

  it('counts every subscription item as skipped when no matching collection location is active', async () => {
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-no-location',
          email: 'max@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [
            { fractionId: 'fraction-bio', slotId: 'bio:first' },
            { fractionId: 'fraction-paper', slotId: 'paper:first' },
          ],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => []),
      listWasteLocationTourLinks: vi.fn(async () => []),
      listWasteCollectionLocations: vi.fn(async () => []),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      skippedPickupCount: 2,
    });
  });

  it('ignores materialized pickup dates whose tour cannot be resolved back to an active fraction mapping', async () => {
    vi.doMock('./waste-management-mainserver-sync.materialization.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./waste-management-mainserver-sync.materialization.js')>();
      return {
        ...actual,
        buildMaterializedLocationTourPickupDates: vi.fn(() => [
          {
            id: 'materialized-ghost',
            locationId: 'location-1',
            tourId: 'tour-missing',
            pickupDate: '2026-06-17',
            note: null,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z',
          },
        ]),
      };
    });

    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-1',
          email: 'max@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true }]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 0,
      duplicateOutboxCount: 0,
    });
  });

  it('skips invalid reminder slots and ignores pickup dates beyond the lookahead window', async () => {
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-invalid-slot',
          email: 'max@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'unknown-slot' }],
        },
        {
          id: 'subscription-lookahead',
          email: 'erika@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-2',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true }]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => [{ id: 'pickup-1', locationId: 'location-1', tourId: 'tour-1', pickupDate: '2026-06-25' }]),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 0,
      duplicateOutboxCount: 0,
      skippedPickupCount: 1,
    });
  });

  it('leaves future reminder dates outside the lookahead window untouched without enqueuing them', async () => {
    vi.doMock('./waste-management-mainserver-sync.materialization.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./waste-management-mainserver-sync.materialization.js')>();
      return {
        ...actual,
        buildMaterializedLocationTourPickupDates: vi.fn(() => [
          {
            id: 'materialized-future',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-07-10',
            note: null,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z',
          },
        ]),
      };
    });

    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-lookahead',
          email: 'erika@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-2',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true }]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 0,
      duplicateOutboxCount: 0,
      skippedPickupCount: 0,
    });
  });

  it('signs unsubscribe links with the persisted reminder signing secret instead of the database url', async () => {
    vi.doMock('./waste-management-mainserver-sync.materialization.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./waste-management-mainserver-sync.materialization.js')>();
      return {
        ...actual,
        buildMaterializedLocationTourPickupDates: vi.fn(() => [
          {
            id: 'materialized-secret',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-06-17',
            note: null,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z',
          },
        ]),
      };
    });

    const unsubscribeTokenHash =
      'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const enqueueOutboxEntry = vi.fn(async () => 'inserted' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-secret',
          email: 'erika@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash,
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', maxLeadDays: 3, defaultLeadDays: 1 }] },
          },
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          cityId: 'city-1',
          regionId: undefined,
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: 'weekly',
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [
        { id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const secret = 'persisted-reminder-signing-secret';
    const runtime = (await import('./waste-management-operations.server.js')).createWasteManagementOperationRuntime({
      listInterfaceRecords: vi.fn(async () => [
        {
          ...createInterfaceRecordWithEmailReminderConfig(),
          publicConfig: {
            ...createInterfaceRecordWithEmailReminderConfig().publicConfig,
            emailReminderSigningSecret: secret,
          },
        },
      ]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    const firstEnqueueCall = (
      enqueueOutboxEntry.mock.calls as unknown as Array<
        [ { readonly payload: { readonly templatePayload: { readonly unsubscribeUrl: string } } } ]
      >
    ).at(0);
    const enqueuedEntry = firstEnqueueCall?.[0];
    expect(enqueuedEntry).toBeTruthy();
    const templatePayload = enqueuedEntry!.payload.templatePayload;
    const unsubscribeUrl = new URL(templatePayload.unsubscribeUrl);
    const token = unsubscribeUrl.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(readPublicWasteUnsubscribeTokenSubscriptionId(token!)).toBe('subscription-secret');
    expect(
      verifyPublicWasteUnsubscribeToken({
        token: token!,
        subscriptionId: 'subscription-secret',
        unsubscribeTokenHash,
        secret,
      })
    ).toBe(true);
    expect(
      verifyPublicWasteUnsubscribeToken({
        token: token!,
        subscriptionId: 'subscription-secret',
        unsubscribeTokenHash,
        secret: 'postgres://waste:test@localhost:5432/waste',
      })
    ).toBe(false);
  });

  it('counts duplicate reminder outbox entries separately from inserted ones', async () => {
    vi.doMock('./waste-management-mainserver-sync.materialization.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./waste-management-mainserver-sync.materialization.js')>();
      return {
        ...actual,
        buildMaterializedLocationTourPickupDates: vi.fn(() => [
          {
            id: 'materialized-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-06-17',
            note: null,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z',
          },
        ]),
      };
    });

    const enqueueOutboxEntry = vi.fn(async () => 'duplicate' as const);
    const reminderRepository = {
      listActiveSubscriptions: vi.fn(async () => [
        {
          id: 'subscription-1',
          email: 'max@example.org',
          locationLabel: 'Perleberg',
          unsubscribeTokenHash: 'token-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          items: [{ fractionId: 'fraction-bio', slotId: 'bio:first' }],
        },
      ]),
      enqueueOutboxEntry,
    };
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne' },
          containerSize: undefined,
          color: '#008000',
          description: undefined,
          active: true,
          reminderConfig: {
            reminderCount: 'once',
            channels: { push: false, email: true, calendar: false },
            email: { slots: [{ id: 'bio:first', defaultLeadDays: 1 }] },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-1',
          name: 'Biotour',
          wasteFractionIds: ['fraction-bio'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourLinks: vi.fn(async () => [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1', active: true }]),
      listWasteCollectionLocations: vi.fn(async () => [
        {
          id: 'location-1',
          regionId: undefined,
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: undefined,
          active: true,
        },
      ]),
      listWasteLocationTourPickupDates: vi.fn(async () => []),
      listWasteTourDateShifts: vi.fn(async () => []),
      listWasteGlobalDateShifts: vi.fn(async () => []),
      listWasteHolidayRules: vi.fn(async () => []),
    });

    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
        createWasteEmailReminderRepository: vi.fn(() => reminderRepository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() =>
        createPoolMock(
          createSqlClientMock(async () => ({
            rowCount: 0,
            rows: [],
          }))
        )
      ),
      now: () => new Date('2026-06-15T06:00:00.000Z'),
    });

    const result = await runtime.materializeEmailReminders('instance-1', {
      operation: 'materialize-email-reminders',
      referenceTime: '2026-06-15T06:00:00.000Z',
    });

    expect(enqueueOutboxEntry).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      operation: 'materialize-email-reminders',
      mode: 'executed',
      createdOutboxCount: 0,
      duplicateOutboxCount: 1,
    });
  });

  it('fails closed when email outbox processing is requested without a mail dispatcher', async () => {
    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      listInterfaceRecords: vi.fn(async () => [createInterfaceRecordWithEmailReminderConfig()]),
    });

    await expect(
      runtime.processEmailReminderOutbox('instance-1', {
        operation: 'process-email-reminder-outbox',
      })
    ).rejects.toThrowError('mail_dispatch_not_configured');
  });
});

const createWasteEmailReminderConfig = () => ({
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'transport-smtp',
  publicBaseUrl: 'https://demo.abfallkalender.example',
  doiConfirmPath: '/erinnerungen/bestaetigen',
  unsubscribePath: '/erinnerungen/abmelden',
  signupSuccessPath: '/erinnerungen/pending',
  activationSuccessPath: '/erinnerungen/aktiviert',
  unsubscribeSuccessPath: '/erinnerungen/abgemeldet',
  invalidTokenPath: '/erinnerungen/ungueltig',
  fromName: 'Ihr Mülli',
  fromEmail: 'noreply@abfallkalender.example',
  replyToEmail: 'abfall@example.org',
  serviceLabel: 'Landkreis Prignitz',
  privacyPolicyUrl: 'https://demo.abfallkalender.example/datenschutz',
  imprintUrl: 'https://demo.abfallkalender.example/impressum',
  consentLabel: 'Ich stimme der Verarbeitung zu.',
  consentVersion: '2026-06',
  dataControllerLabel: 'Landkreis Prignitz',
  dataProtectionContactEmail: 'datenschutz@example.org',
  doiSubjectTemplate: 'Bitte E-Mail-Erinnerung bestätigen',
  doiPreheader: 'Bestätigen Sie Ihre Anmeldung.',
  doiIntroText: 'Bitte bestätigen Sie Ihre Anmeldung zur E-Mail-Erinnerung.',
  doiButtonLabel: 'Jetzt bestätigen',
  doiFallbackText: 'Falls der Button nicht funktioniert, nutzen Sie den Link.',
  doiExpiryNoticeText: 'Der Link ist zeitlich begrenzt gültig.',
  reminderSubjectTemplate: 'Abfalltermine für {{locationLabel}}',
  reminderIntroTemplate: 'Nicht vergessen: {{pickupDate}}',
  reminderListIntroTemplate: 'Folgende Fraktionen stehen an:',
  reminderOutroText: 'Mit freundlichen Grüßen\nIhr Mülli',
  unsubscribeLinkLabel: 'E-Mail-Erinnerung abbestellen',
  reminderReasonText: 'Sie erhalten diese Nachricht, weil Sie eine Erinnerung eingerichtet haben.',
  unsubscribeSuccessHeadline: 'E-Mail-Erinnerung deaktiviert',
  unsubscribeSuccessBody: 'Der Dienst wurde deaktiviert.',
  unsubscribeAlreadyDoneHeadline: 'Bereits deaktiviert',
  unsubscribeAlreadyDoneBody: 'Die Erinnerung war bereits deaktiviert.',
  unsubscribeErrorHeadline: 'Abmeldung fehlgeschlagen',
  unsubscribeErrorBody: 'Der Link ist ungültig.',
  maxSubscriptionsPerEmailAndLocation: 5,
  signupRateLimitPerIpPerHour: 10,
  signupRateLimitPerEmailPerHour: 5,
  doiTokenTtlHours: 48,
  pendingSubscriptionTtlHours: 72,
  materializationLookaheadDays: 7,
  unsubscribeTokenTtlDays: 365,
} as const);

const createInterfaceRecordWithEmailReminderConfig = (): ExternalInterfaceRecord => ({
  ...createInterfaceRecord(),
  publicConfig: {
    projectUrl: 'https://tenant.supabase.co',
    schemaName: 'wm',
    wasteManagementSelected: true,
    emailReminderConfig: createWasteEmailReminderConfig(),
  },
});

const createMailTransportInterfaceRecord = (overrides: {
  readonly id?: string;
  readonly transportId?: string;
  readonly alias?: string;
  readonly host?: string;
  readonly maxBatchSize?: number;
  readonly rateLimitPerMinute?: number;
} = {}): ExternalInterfaceRecord => ({
  id: overrides.id ?? 'mail-transport-1',
  instanceId: 'instance-1',
  typeKey: 'mail_transport',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'SMTP Transport',
  alias: overrides.alias ?? 'smtp-default',
  enabled: true,
  isDefault: true,
  category: 'api',
  baseUrl: `smtp://${overrides.host ?? 'mail.example.org'}`,
  authMode: 'basic',
  publicConfig: {
    transportId: overrides.transportId ?? 'transport-smtp',
    transportType: 'smtp',
    securityMode: 'starttls',
    authMode: 'basic',
    host: overrides.host ?? 'mail.example.org',
    port: 587,
    username: 'mailer',
    defaultFromEmail: 'transport@example.org',
    defaultFromName: 'Transport Default',
    defaultReplyToEmail: 'transport-reply@example.org',
    maxBatchSize: overrides.maxBatchSize ?? 25,
    ...(overrides.rateLimitPerMinute ? { rateLimitPerMinute: overrides.rateLimitPerMinute } : {}),
  },
  secretConfigCiphertext: protectField(
    JSON.stringify({ password: 'smtp-password' }),
    buildExternalInterfaceSecretConfigAad(overrides.id ?? 'mail-transport-1')
  ) ?? undefined,
  statusCheckKind: 'mail_transport',
  visibleStatus: 'ok',
  lastCheckStatus: 'succeeded',
  lastCheckedAt: '2026-06-14T08:00:00.000Z',
  updatedAt: '2026-06-14T08:00:00.000Z',
});

const createSqlClientMock = (query: SqlClient['query']): SqlClient => ({
  query,
  release: vi.fn(),
});

const createPoolMock = (client: SqlClient): WasteOperationSqlPool => ({
  connect: vi.fn(async () => client),
  end: vi.fn(async () => undefined),
});

const createRepositoryMock = (
  overrides: Partial<ReturnType<typeof createRepositoryMockBase>> = {}
) => ({
  ...createRepositoryMockBase(),
  ...overrides,
});

const createRepositoryMockBase = () => ({
  listWasteFractions: vi.fn(async (): Promise<unknown[]> => []),
  listWasteRegions: vi.fn(async (): Promise<unknown[]> => []),
  listWasteCities: vi.fn(async (): Promise<unknown[]> => []),
  listWasteStreets: vi.fn(async (): Promise<unknown[]> => []),
  listWasteHouseNumbers: vi.fn(async (): Promise<unknown[]> => []),
  listWasteCollectionLocations: vi.fn(async (): Promise<unknown[]> => []),
  listWasteTours: vi.fn(async (): Promise<unknown[]> => []),
  listWasteLocationTourLinks: vi.fn(async (): Promise<unknown[]> => []),
  listWasteLocationTourPickupDates: vi.fn(async (): Promise<unknown[]> => []),
  listWasteTourAssignments: vi.fn(async (): Promise<unknown[]> => []),
  listWasteTourDateShifts: vi.fn(async (): Promise<unknown[]> => []),
  listWasteGlobalDateShifts: vi.fn(async (): Promise<unknown[]> => []),
  listWasteHolidayRules: vi.fn(async (): Promise<unknown[]> => []),
  upsertWasteRegion: vi.fn(async () => undefined),
  upsertWasteCity: vi.fn(async () => undefined),
  upsertWasteStreet: vi.fn(async () => undefined),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  upsertWasteFraction: vi.fn(async () => undefined),
  upsertWasteTour: vi.fn(async () => undefined),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  upsertWasteLocationTourPickupDate: vi.fn(async () => undefined),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
});
