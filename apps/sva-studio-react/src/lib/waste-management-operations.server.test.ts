import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';
import { protectField } from '@sva/iam-admin/encryption';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import * as XLSX from 'xlsx';
import type { SqlClient, WasteOperationSqlPool } from './waste-management-operations.types.js';

import { createWasteManagementOperationRuntime } from './waste-management-operations.server.js';
import {
  applySchemaStatements,
  buildWasteFractionShortLabelBackfillStatement,
} from './waste-management-operations.schema.js';
import { resolveRuntimeDataSource } from './waste-management-operations.shared.js';

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
    vi.doMock('./waste-management-mainserver-sync.server.js', () => ({
      runWasteManagementMainserverSyncForInstance: runWasteManagementMainserverSyncForInstanceMock,
    }));
    createOrUpdateSvaMainserverStaticContentMock.mockReset();
    runWasteManagementMainserverSyncForInstanceMock.mockReset();
  });

  it('applies schema migrations against the resolved waste schema', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValue({ rowCount: 0, rows: requiredTableRows });
    const pool = {
      connect: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
      end: vi.fn(async () => undefined),
    };
    const runtime = createWasteManagementOperationRuntime({
      loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() => pool),
    });

    const result = await runtime.applyMigrations('instance-1', {
      operation: 'apply-migrations',
      targetSchema: 'wm',
    });

    expect(result.details).toMatchObject({
      operation: 'apply-migrations',
      mode: 'executed',
      appliedStatementCount: expect.any(Number),
      schemaInspection: {
        schemaName: 'wm',
        missingTables: [],
      },
    });
    expect(query).toHaveBeenCalledWith('SET search_path TO "wm", public;');
  });

  it('includes custom recurrence presets, holiday rules and tour preset references in schema statements', () => {
    const statements = applySchemaStatements('wm').join('\n');
    expect(statements).toContain('reminder_config JSONB');
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS "wm".waste_fractions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL');
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS reminder_config JSONB');
    expect(statements).toContain('UPDATE "wm".waste_fractions');
    expect(statements).toContain("SET reminder_config = jsonb_strip_nulls");
    expect(statements).toContain("WHERE reminder_config IS NULL");
    expect(statements).toContain(`id::text || ':push:first'`);
    expect(statements).toContain('pdf_short_label TEXT');
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS pdf_short_label TEXT');
    expect(statements).toContain(buildWasteFractionShortLabelBackfillStatement('"wm".waste_fractions'));
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ALTER COLUMN pdf_short_label SET NOT NULL');
    expect(statements).toContain('waste_custom_recurrence_presets');
    expect(statements).toContain('waste_holiday_rules');
    expect(statements).toContain('holiday_date DATE NOT NULL');
    expect(statements).toContain('idx_waste_holiday_rules_state_year');
    expect(statements).toContain('custom_recurrence_id UUID');
    expect(statements).toContain('ALTER TABLE "wm".waste_tours ADD COLUMN IF NOT EXISTS custom_recurrence_id UUID');
    expect(statements).toContain('waste_tours_custom_recurrence_id_fkey');
    expect(statements).toContain('idx_waste_tours_custom_recurrence_id');
    expect(statements).toContain("reminder_count TEXT NOT NULL DEFAULT 'none'");
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS reminder_count TEXT NOT NULL DEFAULT \'none\'');
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS first_reminder_max_lead_days INTEGER');
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS second_reminder_max_lead_days INTEGER');
    expect(statements).toContain('ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS reminder_channel_push_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    expect(statements).toContain('waste_fractions_reminder_count_check');
  });

  it('normalizes legacy reminders without active channels to none during reminder_config backfill', () => {
    const statements = applySchemaStatements('wm').join('\n');

    expect(statements).toMatch(
      /WHEN reminder_count IN \('once', 'twice'\) AND \(\s*COALESCE\(reminder_channel_push_enabled, FALSE\) OR\s*COALESCE\(reminder_channel_email_enabled, FALSE\) OR\s*COALESCE\(reminder_channel_calendar_enabled, FALSE\)\s*\) THEN reminder_count/s
    );
    expect(statements).toContain("'reminder_count'");
    expect(statements).toContain("ELSE 'none'");
  });

  it('parses geography imports as a dry run from an xlsx workbook', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const pool = {
      connect: vi.fn(async () => ({
        query,
        release: vi.fn(),
      })),
      end: vi.fn(async () => undefined),
    };
    const runtime = createWasteManagementOperationRuntime({
      loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() => pool),
      readBinarySource: vi.fn(async () => createImportWorkbookBytes()),
    });

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.geografie-abholorte',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: true,
      blobRef: 'fixture.xlsx',
    });

    expect(result.details).toMatchObject({
      operation: 'import-data',
      mode: 'executed',
      dryRun: true,
      importProfileId: 'waste-management.geografie-abholorte',
    });
  });

  it('initializes the data source with connection check and schema inspection', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: requiredTableRows.length,
      rows: requiredTableRows,
    });
    const release = vi.fn();
    const pool = {
      connect: vi
        .fn()
        .mockResolvedValueOnce({
          release,
        })
        .mockResolvedValueOnce({
          query,
          release,
        }),
      end: vi.fn(async () => undefined),
    };
    const runWasteConnectionCheck = vi.fn(async (input: { readonly probe: (resolved: { readonly databaseUrl: string }) => Promise<void> }) => {
      await input.probe({ databaseUrl: 'postgres://waste:test@localhost:5432/waste' });
      return {
        status: 'succeeded',
        checkedAt: '2026-05-10T10:05:00.000Z',
      };
    });
    const resolveWasteDataSource = vi.fn(async () => ({
      instanceId: 'instance-1',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste',
      serviceRoleKey: 'service-key',
      projectUrl: 'https://tenant.supabase.co',
      enabled: true,
    }));

    vi.doMock('@sva/server-runtime', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/server-runtime')>();
      return {
        ...actual,
        resolveWasteDataSource,
        runWasteConnectionCheck,
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      createPool: vi.fn(() => pool),
      now: () => new Date('2026-05-10T10:05:00.000Z'),
    });

    const result = await runtime.initializeDataSource('instance-1', {
      operation: 'initialize-data-source',
      targetSchema: 'wm',
    });

    expect(resolveWasteDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
      })
    );
    expect(runWasteConnectionCheck).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.tables'),
      ['wm', expect.any(Array)]
    );
    expect(result.details).toMatchObject({
      operation: 'initialize-data-source',
      mode: 'executed',
      connectionCheck: {
        status: 'succeeded',
      },
      schemaInspection: {
        schemaName: 'wm',
        missingTables: [],
      },
    });
  });

  it('syncs wasteTypes static content to the mainserver', async () => {
    vi.doMock('@sva/sva-mainserver/server', () => ({
      createOrUpdateSvaMainserverStaticContent: createOrUpdateSvaMainserverStaticContentMock,
    }));
    createOrUpdateSvaMainserverStaticContentMock.mockResolvedValue({
      id: 'static-1',
    });

    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-bio',
          name: 'Biotonne auf Abruf',
          pdfShortLabel: 'BIO',
          translations: { de: 'Biotonne auf Abruf' },
          containerSize: undefined,
          color: '#8B4513',
          description: 'Nur auf Abruf',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '',
          updatedAt: '',
        },
      ]),
    });
    const runtime = await createRuntimeWithRepositoryMock(repository, createToursWorkbookBytes(), query);

    const result = await runtime.syncWasteTypes('instance-1', {
      operation: 'sync-waste-types',
      keycloakSubject: 'user-1',
      activeOrganizationId: 'org-1',
    });

    expect(createOrUpdateSvaMainserverStaticContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
        keycloakSubject: 'user-1',
        activeOrganizationId: 'org-1',
        staticContent: {
          name: 'wasteTypes',
          content: JSON.stringify(
            {
              BIO: {
                label: 'Biotonne auf Abruf',
                color: '#8B4513',
                selected_color: '#8B4513',
                id: 'fraction-bio',
                short_label: 'BIO',
                active: true,
                description: 'Nur auf Abruf',
                container_size: null,
                translations: { de: 'Biotonne auf Abruf' },
                reminders: {
                  reminder_count: 'none',
                  channels: {
                    push: false,
                    email: false,
                    calendar: false,
                  },
                },
              },
            },
            null,
            2
          ),
        },
      })
    );
    expect(query).toHaveBeenCalledWith('SET search_path TO "wm", public;');
    expect(query).toHaveBeenCalledWith(buildWasteFractionShortLabelBackfillStatement('waste_fractions'));
    expect(result.details).toMatchObject({
      operation: 'sync-waste-types',
      mode: 'executed',
      staticContentName: 'wasteTypes',
      fractionCount: 1,
      staticContentId: 'static-1',
    });
  });

  it('delegates mainserver sync jobs to the dedicated sync helper', async () => {
    runWasteManagementMainserverSyncForInstanceMock.mockResolvedValue({
      studioItemCount: 4,
      mainserverItemCount: 3,
      createCount: 2,
      deleteCount: 1,
      errorCount: 0,
      createItems: [],
      deleteItems: [],
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime();

    await expect(runtime.syncMainserver('de-musterhausen', { operation: 'sync-mainserver' })).resolves.toMatchObject({
      details: expect.objectContaining({
        operation: 'sync-mainserver',
        createCount: 2,
        deleteCount: 1,
      }),
    });
    expect(runWasteManagementMainserverSyncForInstanceMock).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      runtimeDeps: {},
      syncInput: { operation: 'sync-mainserver' },
    });
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

  it('resolves interface-based waste secrets with the shared default revealSecret path', async () => {
    const secretConfigCiphertext = protectField(
      JSON.stringify({
        databaseUrl: 'postgres://waste:test@localhost:5432/waste',
        serviceRoleKey: 'service-key',
      }),
      buildExternalInterfaceSecretConfigAad('iface-1')
    );

    const dataSource = await resolveRuntimeDataSource(
      {
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...createInterfaceRecord(),
          publicConfig: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'wm',
          },
          secretConfigCiphertext: secretConfigCiphertext ?? undefined,
        })),
      },
      'instance-1'
    );

    expect(dataSource).toMatchObject({
      instanceId: 'instance-1',
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      databaseUrl: 'postgres://waste:test@localhost:5432/waste',
      serviceRoleKey: 'service-key',
      visibleStatus: 'ok',
    });
  });

  it('imports tours with recurrence and custom dates in non-dry-run mode', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository);

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.touren',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: 'fixture.xlsx',
    });

    expect(repository.upsertWasteTour).toHaveBeenCalledWith({
      id: 'tour-1',
      name: 'Restmüll Nord',
      description: 'Standardtour Nord',
      wasteFractionIds: ['rest', 'bio'],
      recurrence: 'weekly',
      firstDate: '2026-01-10',
      endDate: '2026-12-31',
      customDates: [{ date: '2026-01-10' }, { date: '2026-01-24' }],
      active: true,
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 1,
    });
  });

  it('reads import workbooks from inline base64 data urls', async () => {
    const repository = createRepositoryMock();
    vi.doMock('@sva/data-repositories', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@sva/data-repositories')>();
      return {
        ...actual,
        createWasteMasterDataRepository: vi.fn(() => repository),
      };
    });

    const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
    const runtime = createRuntime({
      loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() => ({
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
          release: vi.fn(),
        })),
        end: vi.fn(async () => undefined),
      })),
    });

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.touren',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(createMinimalToursWorkbookBytes()).toString('base64')}`,
    });

    expect(repository.upsertWasteTour).toHaveBeenCalledWith({
      id: 'tour-inline',
      name: 'Inline Tour',
      description: undefined,
      wasteFractionIds: ['rest'],
      recurrence: null,
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      active: false,
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 1,
    });
  });

  it('imports geography rows with optional street and house number fields through the real repository path', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    const runtime = await createRuntimeWithRealRepository(createExtendedGeographyWorkbookBytes(), query);

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.geografie-abholorte',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: 'fixture.xlsx',
    });

    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      rows: 1,
      upserts: 5,
    });
    expect(query).toHaveBeenCalled();
  });

  it('imports global and tour date shifts in non-dry-run mode', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository, createDateShiftWorkbookBytes());

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.ausweichtermine',
      sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dryRun: false,
      blobRef: 'fixture.xlsx',
    });

    expect(repository.upsertWasteTourDateShift).toHaveBeenCalledWith({
      id: 'shift-tour',
      tourId: 'tour-1',
      originalDate: '2026-04-03',
      actualDate: '2026-04-04',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'good-friday',
      followUpMode: 'propagate-series',
      description: 'Feiertagsverschiebung',
    });
    expect(repository.upsertWasteGlobalDateShift).toHaveBeenCalledWith({
      id: 'shift-global',
      originalDate: '2026-12-25',
      actualDate: '2026-12-24',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'christmas-day',
      description: 'Globale Feiertagsverschiebung',
      tourIds: ['tour-1', 'tour-2'],
    });
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      upserts: 2,
    });
  });

  it('imports location-based tour assignments from fraction columns in csv mode', async () => {
    const repository = createRepositoryMock({
      listWasteFractions: vi.fn(async () => [
        {
          id: 'fraction-paper',
          name: 'Papier',
          translations: undefined,
          containerSize: undefined,
          color: '#00aaee',
          description: undefined,
          active: true,
          createdAt: '',
          updatedAt: '',
        },
      ]),
      listWasteTours: vi.fn(async () => [
        {
          id: 'tour-paper-existing',
          name: 'PPK.7.2',
          description: undefined,
          wasteFractionIds: ['fraction-paper'],
          recurrence: null,
          firstDate: undefined,
          endDate: undefined,
          customDates: undefined,
          active: true,
          locationCount: undefined,
          createdAt: '',
          updatedAt: '',
        },
      ]),
    });
    const runtime = await createRuntimeWithRepositoryMock(repository, createFractionAssignmentCsvBytes());

    const result = await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.ortsbezogene-tourtermine',
      sourceFormat: 'text/csv',
      dryRun: false,
      blobRef: 'fixture.csv',
    });

    expect(repository.upsertWasteFraction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hausmüll',
        color: '#808080',
        active: true,
      })
    );
    expect(repository.upsertWasteTour).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HM.3.3',
        wasteFractionIds: expect.any(Array),
        active: true,
      })
    );
    expect(repository.upsertWasteCollectionLocation).toHaveBeenCalledTimes(2);
    expect(repository.upsertWasteLocationTourLink).toHaveBeenCalledTimes(4);
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      rowCount: 2,
      createdFractions: 2,
      createdTours: 2,
      createdLocations: 2,
      createdAssignments: 4,
      skippedRows: 0,
      errorCount: 0,
    });
  });

  it('carries pickup-date notes through the ortsbezogene-tourtermine runtime import path', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(
      repository,
      new TextEncoder().encode([
        'Ort;Straße;Hausnummern;Abholdatum;Hinweis;Hausmüll;Papier;Gelbe Säcke;;;;',
        'Perleberg;Ackerstraße;Alle Hausnummern;2026-02-03;  Schnee-Ersatztermin  ;HM.3.3;PPK.7.2;LVP.9.4;;;;',
        'Bad Wilsnack;Alle Straßen;Alle Hausnummern;2026-02-10;   ;;PPK.7.2;;;;;',
      ].join('\n'))
    );

    await runtime.importData('instance-1', {
      operation: 'import-data',
      importProfileId: 'waste-management.ortsbezogene-tourtermine',
      sourceFormat: 'text/csv',
      dryRun: false,
      blobRef: 'fixture.csv',
    });

    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenCalledTimes(4);
    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pickupDate: '2026-02-03',
        note: 'Schnee-Ersatztermin',
      })
    );
    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        pickupDate: '2026-02-10',
        note: null,
      })
    );
  });

  it('reports live block progress for location-based tour assignment imports', async () => {
    const repository = createRepositoryMock();
    const reportedProgress: Array<Record<string, unknown>> = [];
    const runtime = await createRuntimeWithRepositoryMock(repository, createLargeFractionAssignmentCsvBytes());

    const result = await runtime.importData(
      'instance-1',
      {
        operation: 'import-data',
        importProfileId: 'waste-management.ortsbezogene-tourtermine',
        sourceFormat: 'text/csv',
        dryRun: false,
        blobRef: 'fixture.csv',
      },
      {
        reportProgress: async (progress) => {
          reportedProgress.push(progress as Record<string, unknown>);
        },
      }
    );

    expect(reportedProgress).toEqual([
      expect.objectContaining({
        completedSteps: 0,
        totalSteps: 30,
        currentPhase: 'waste-management.import-preparation',
        currentStepKey: 'prepare-import',
        details: { processedRows: 0, totalRows: 30 },
      }),
      expect.objectContaining({
        completedSteps: 0,
        totalSteps: 30,
        currentPhase: 'waste-management.import-running',
        currentStepKey: 'process-rows',
        details: { processedRows: 0, totalRows: 30 },
      }),
      expect.objectContaining({
        completedSteps: 25,
        totalSteps: 30,
        currentPhase: 'waste-management.import-running',
        currentStepKey: 'process-rows',
        details: { processedRows: 25, totalRows: 30 },
      }),
      expect.objectContaining({
        completedSteps: 30,
        totalSteps: 30,
        currentPhase: 'waste-management.import-running',
        currentStepKey: 'process-rows',
        details: { processedRows: 30, totalRows: 30 },
      }),
      expect.objectContaining({
        completedSteps: 30,
        totalSteps: 30,
        currentPhase: 'waste-management.completed',
        currentStepKey: 'complete-operation',
        details: { processedRows: 30, totalRows: 30 },
      }),
    ]);
    expect(result.details).toMatchObject({
      operation: 'import-data',
      dryRun: false,
      rowCount: 30,
      skippedRows: 0,
      errorCount: 0,
    });
  });

  it('rejects invalid schemas, foreign schema targets, and malformed blob references deterministically', async () => {
    const runtime = createWasteManagementOperationRuntime({
      loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() => ({
        connect: vi.fn(async () => ({
          query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
          release: vi.fn(),
        })),
        end: vi.fn(async () => undefined),
      })),
    });

    await expect(
      runtime.applyMigrations('instance-1', {
        operation: 'apply-migrations',
        targetSchema: 'wm-invalid!',
      })
    ).rejects.toThrowError('invalid_waste_schema_target:wm-invalid!');

    await expect(
      runtime.applyMigrations('instance-1', {
        operation: 'apply-migrations',
        targetSchema: 'foreign_schema',
      })
    ).rejects.toThrowError('invalid_waste_schema_target:foreign_schema');

    await expect(
      runtime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.touren',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: true,
        blobRef: 'blob:fixture.xlsx',
      })
    ).rejects.toThrowError('unsupported_blob_ref:blob_url');
  });

  it('rejects imports with missing columns and invalid boolean values', async () => {
    const missingColumnRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['tour_id', 'tour_name', 'active'],
      ['tour-1', 'Incomplete Tour', 'true'],
    ]));

    await expect(
      missingColumnRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.touren',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('missing_import_column:waste-management.touren:waste_fraction_ids');

    const invalidBooleanRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['region_id', 'region_name', 'city_id', 'city_name', 'location_id', 'active'],
      ['region-1', 'Nord', 'city-1', 'Musterstadt', 'location-1', 'maybe'],
    ]));

    await expect(
      invalidBooleanRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.geografie-abholorte',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('invalid_boolean:active');
  });

  it('rejects invalid recurrence values in tour imports', async () => {
    const runtime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['tour_id', 'tour_name', 'waste_fraction_ids', 'active', 'recurrence'],
      ['tour-1', 'Restmüll Nord', 'rest|bio', 'true', 'monthly-ish'],
    ]));

    await expect(
      runtime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.touren',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('invalid_recurrence:monthly-ish');
  });

  it('rejects invalid date shift rows deterministically', async () => {
    const invalidContextRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year'],
      ['shift-1', 'sideways', '2026-04-03', '2026-04-04', 'true'],
    ]));
    await expect(
      invalidContextRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.ausweichtermine',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('invalid_shift_context:sideways');

    const missingTourRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year', 'tour_id'],
      ['shift-2', 'tour', '2026-04-03', '2026-04-04', 'true', ''],
    ]));
    await expect(
      missingTourRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.ausweichtermine',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('missing_tour_id:shift-2');

    const invalidReasonRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year', 'reason_type'],
      ['shift-3', 'global', '2026-12-25', '2026-12-24', 'true', 'mystery'],
    ]));
    await expect(
      invalidReasonRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.ausweichtermine',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('invalid_reason_type:mystery');

    const invalidFollowUpRuntime = await createRuntimeWithRepositoryMock(createRepositoryMock(), createWorkbookBytes([
      ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year', 'tour_id', 'follow_up_mode'],
      ['shift-4', 'tour', '2026-04-03', '2026-04-04', 'true', 'tour-1', 'teleport-series'],
    ]));
    await expect(
      invalidFollowUpRuntime.importData('instance-1', {
        operation: 'import-data',
        importProfileId: 'waste-management.ausweichtermine',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dryRun: false,
        blobRef: 'fixture.xlsx',
      })
    ).rejects.toThrowError('invalid_follow_up_mode:teleport-series');
  });

  it('seeds baseline entities through the repository', async () => {
    const repository = createRepositoryMock();
    const runtime = await createRuntimeWithRepositoryMock(repository);

    const result = await runtime.seedData('instance-1', {
      operation: 'seed-data',
      seedKey: 'baseline',
    });

    expect(repository.upsertWasteRegion).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteCity).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteStreet).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteHouseNumber).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteCollectionLocation).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteFraction).toHaveBeenCalledTimes(2);
    expect(repository.upsertWasteTour).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteLocationTourLink).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteTourDateShift).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteGlobalDateShift).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      operation: 'seed-data',
      seedKey: 'baseline',
      seededEntityCount: 11,
    });
  });

  it('rejects unsupported seed keys', async () => {
    const runtime = await createRuntimeWithRepositoryMock(createRepositoryMock());

    await expect(
      runtime.seedData('instance-1', {
        operation: 'seed-data',
        seedKey: 'baseline-v2' as 'baseline',
      })
    ).rejects.toThrowError('unsupported_seed_key:baseline-v2');
  });

  it('resets all waste tables and rejects blank or legacy confirmation tokens', async () => {
    const query = vi.fn(async (text: string) => ({
      rowCount: text.startsWith('DELETE FROM') ? 1 : 0,
      rows: [],
    }));
    const runtime = createWasteManagementOperationRuntime({
      loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
      revealSecret: vi.fn(revealSupabaseSecretConfig),
      createPool: vi.fn(() => ({
        connect: vi.fn(async () => ({
          query,
          release: vi.fn(),
        })),
        end: vi.fn(async () => undefined),
      })),
    });

    await expect(
      runtime.resetData('instance-1', {
        operation: 'reset-data',
        confirmationToken: '   ',
      })
    ).rejects.toThrowError('missing_reset_confirmation_token');

    await expect(
      runtime.resetData('instance-1', {
        operation: 'reset-data',
        confirmationToken: 'confirm-reset',
      })
    ).rejects.toThrowError('invalid_reset_confirmation_token');

    const result = await runtime.resetData('instance-1', {
      operation: 'reset-data',
      confirmationToken: 'RESET',
    });

    expect(query).toHaveBeenCalledWith('DELETE FROM waste_location_tour_links;');
    expect(query).toHaveBeenCalledWith('DELETE FROM waste_regions;');
    expect(result.details).toMatchObject({
      operation: 'reset-data',
      confirmationTokenLength: 5,
    });
  });
});

const requiredTableRows = [
  { table_name: 'waste_cities' },
  { table_name: 'waste_collection_locations' },
  { table_name: 'waste_custom_recurrence_presets' },
  { table_name: 'waste_fractions' },
  { table_name: 'waste_global_date_shifts' },
  { table_name: 'waste_holiday_rules' },
  { table_name: 'waste_house_numbers' },
  { table_name: 'waste_location_tour_links' },
  { table_name: 'waste_location_tour_pickup_dates' },
  { table_name: 'waste_regions' },
  { table_name: 'waste_streets' },
  { table_name: 'waste_tour_date_shifts' },
  { table_name: 'waste_tours' },
];

const createImportWorkbookBytes = (): Uint8Array => {
  return createWorkbookBytes([
    ['region_id', 'region_name', 'city_id', 'city_name', 'location_id', 'active'],
    ['00000000-0000-4000-8000-000000000101', 'Nord', '00000000-0000-4000-8000-000000000102', 'Musterstadt', '00000000-0000-4000-8000-000000000103', 'true'],
  ]);
};

const createToursWorkbookBytes = (): Uint8Array => {
  return createWorkbookBytes([
    ['tour_id', 'tour_name', 'waste_fraction_ids', 'active', 'description', 'recurrence', 'first_date', 'end_date', 'custom_dates'],
    ['tour-1', 'Restmüll Nord', 'rest|bio', 'yes', 'Standardtour Nord', 'weekly', '2026-01-10', '2026-12-31', '2026-01-10|2026-01-24'],
  ]);
};

const createDateShiftWorkbookBytes = (): Uint8Array => {
  return createWorkbookBytes([
    ['shift_id', 'shift_context', 'original_date', 'actual_date', 'has_year', 'tour_id', 'description', 'tour_ids', 'reason_type', 'reason_key', 'follow_up_mode'],
    ['shift-tour', 'tour', '2026-04-03', '2026-04-04', 'true', 'tour-1', 'Feiertagsverschiebung', '', 'holiday', 'good-friday', 'propagate-series'],
    ['shift-global', 'global', '2026-12-25', '2026-12-24', '1', '', 'Globale Feiertagsverschiebung', 'tour-1|tour-2', 'holiday', 'christmas-day', ''],
  ]);
};

const createMinimalToursWorkbookBytes = (): Uint8Array => {
  return createWorkbookBytes([
    ['tour_id', 'tour_name', 'waste_fraction_ids', 'active'],
    ['tour-inline', 'Inline Tour', 'rest', 'false'],
  ]);
};

const createExtendedGeographyWorkbookBytes = (): Uint8Array => {
  return createWorkbookBytes([
    ['region_id', 'region_name', 'city_id', 'city_name', 'location_id', 'active', 'street_id', 'street_name', 'house_number_id', 'house_number_value'],
    ['region-extended', 'Nord', 'city-extended', 'Musterstadt', 'location-extended', '0', 'street-extended', 'Hauptstraße', 'house-extended', '42a'],
  ]);
};

const createFractionAssignmentCsvBytes = (): Uint8Array =>
  new TextEncoder().encode([
    'Ort;Straße;Hausmüll;Papier;Gelbe Säcke;;;;',
    'Perleberg;Ackerstraße;HM.3.3;PPK.7.2;LVP.9.4;;;;',
    'Bad Wilsnack;;;PPK.7.2;;;;;',
  ].join('\n'));

const createLargeFractionAssignmentCsvBytes = (): Uint8Array =>
  new TextEncoder().encode([
    'Ort;Straße;Hausmüll;Papier;;;;;',
    ...Array.from(
      { length: 30 },
      (_, index) => `Ort ${index + 1};Straße ${index + 1};HM.${index + 1};PPK.${index + 1};;;;;`
    ),
  ].join('\n'));

const createWorkbookBytes = (rows: readonly (readonly string[])[]): Uint8Array => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

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

const createMailTransportInterfaceRecord = (): ExternalInterfaceRecord => ({
  id: 'mail-transport-1',
  instanceId: 'instance-1',
  typeKey: 'mail_transport',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'SMTP Transport',
  alias: 'smtp-default',
  enabled: true,
  isDefault: true,
  category: 'api',
  baseUrl: 'smtp://mail.example.org',
  authMode: 'basic',
  publicConfig: {
    transportId: 'transport-smtp',
    transportType: 'smtp',
    securityMode: 'starttls',
    authMode: 'basic',
    host: 'mail.example.org',
    port: 587,
    username: 'mailer',
    defaultFromEmail: 'transport@example.org',
    defaultFromName: 'Transport Default',
    defaultReplyToEmail: 'transport-reply@example.org',
    maxBatchSize: 25,
  },
  secretConfigCiphertext: protectField(
    JSON.stringify({ password: 'smtp-password' }),
    buildExternalInterfaceSecretConfigAad('mail-transport-1')
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

const createRuntimeWithRepositoryMock = async (
  repository: ReturnType<typeof createRepositoryMock>,
  workbookBytes: Uint8Array = createToursWorkbookBytes(),
  query: SqlClient['query'] = vi.fn(async () => ({ rowCount: 0, rows: [] }))
) => {
  vi.doMock('@sva/data-repositories', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@sva/data-repositories')>();
    return {
      ...actual,
      createWasteMasterDataRepository: vi.fn(() => repository),
    };
  });

  const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
  return createRuntime({
    loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
    revealSecret: vi.fn(revealSupabaseSecretConfig),
    createPool: vi.fn(() => createPoolMock(createSqlClientMock(query))),
    readBinarySource: vi.fn(async () => workbookBytes),
  });
};

const createRuntimeWithRealRepository = async (workbookBytes: Uint8Array, query: SqlClient['query']) => {
  const { createWasteManagementOperationRuntime: createRuntime } = await import('./waste-management-operations.server.js');
  return createRuntime({
    loadDefaultInterfaceRecord: vi.fn(async () => createInterfaceRecord()),
    revealSecret: vi.fn(revealSupabaseSecretConfig),
    createPool: vi.fn(() => createPoolMock(createSqlClientMock(query))),
    readBinarySource: vi.fn(async () => workbookBytes),
  });
};
