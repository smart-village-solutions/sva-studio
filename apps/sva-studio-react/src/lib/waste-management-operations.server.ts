import { randomUUID } from 'node:crypto';
import {
  buildWasteTypesStaticContent,
  getWasteManagementImportCatalogEntry,
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  wasteManagementOperationsContract,
  type ExternalInterfaceRecord,
  type MailDispatchPayload,
  type MailTransportConfig,
  type WasteCollectionLocationRecord,
  type WasteFractionRecord,
  type WasteManagementEmailReminderConfig,
} from '@sva/core';
import { createWasteEmailReminderRepository } from '@sva/data-repositories';
import type { MailDispatchMessage, MailDispatchMessageAddress } from '@sva/mail-runtime';
import { runWasteConnectionCheck } from '@sva/server-runtime';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { createOrUpdateSvaMainserverStaticContent } from '@sva/sva-mainserver/server';
import { revealField } from '@sva/auth-runtime/server';

import {
  executeImport,
  parseImportRows,
  parseLocationTourPickupDateImport,
  previewLocationTourPickupDateImport,
} from './waste-management-operations.import.js';
import { baselineIds, seedWasteBaseline } from './waste-management-operations.seed.js';
import {
  applySchemaStatements,
  buildWasteFractionShortLabelBackfillStatement,
  inspectWasteSchema,
} from './waste-management-operations.schema.js';
import { runWasteManagementMainserverSyncForInstance } from './waste-management-mainserver-sync.server.js';
import { buildMaterializedLocationTourPickupDates } from './waste-management-mainserver-sync.materialization.js';
import {
  buildOperationSummary,
  createSqlExecutor,
  defaultCreatePool,
  normalizeOptionalText,
  resolveRuntimeDataSource,
  withWasteClient,
} from './waste-management-operations.shared.js';
import { createWasteManagementUnsubscribeToken } from './waste-management-unsubscribe-token.server.js';
import type {
  WasteManagementOperationRuntime,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';

export type { OperationSummary, WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const DEFAULT_REMINDER_SEND_HOUR_UTC = 6;
const DEFAULT_OUTBOX_RETRY_DELAY_MINUTES = 15;
const DEFAULT_OUTBOX_MAX_ATTEMPTS = 5;
const DEFAULT_OUTBOX_BATCH_SIZE = 25;
const templatePlaceholderPattern = /\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g;

const createUtcIsoAtHour = (date: Date, hourUtc: number): string =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourUtc, 0, 0, 0)
  ).toISOString();

const parseIsoDateUtc = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid_iso_date:${value}`);
  }
  return parsed;
};

const addDaysUtc = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const formatPickupDateLabel = (pickupDate: string): string =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parseIsoDateUtc(pickupDate));

const renderTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(templatePlaceholderPattern, (_match, rawKey: string) => values[rawKey] ?? '');

const toOptionalMailTransportNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const parseInterfaceSecretConfig = (record: ExternalInterfaceRecord): Record<string, string> => {
  if (!record.secretConfigCiphertext) {
    return {};
  }
  const revealed = revealField(record.secretConfigCiphertext, buildExternalInterfaceSecretConfigAad(record.id));
  if (!revealed) {
    throw new Error('secret_unreadable');
  }
  const parsed = JSON.parse(revealed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('secret_unreadable');
  }
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, value]) => (typeof value === 'string' && value.length > 0 ? [[key, value]] : []))
  );
};

const readMailTransportConfigFromRecord = (record: ExternalInterfaceRecord): MailTransportConfig | null => {
  if (record.typeKey !== 'mail_transport') {
    return null;
  }
  const transportId = normalizeOptionalText(typeof record.publicConfig.transportId === 'string' ? record.publicConfig.transportId : undefined);
  const transportType = normalizeOptionalText(typeof record.publicConfig.transportType === 'string' ? record.publicConfig.transportType : undefined);
  const securityMode = normalizeOptionalText(typeof record.publicConfig.securityMode === 'string' ? record.publicConfig.securityMode : undefined);
  const authMode = normalizeOptionalText(typeof record.publicConfig.authMode === 'string' ? record.publicConfig.authMode : undefined);
  const password = normalizeOptionalText(parseInterfaceSecretConfig(record).password);
  if (!transportId || !transportType || !securityMode || !authMode) {
    return null;
  }
  if (authMode === 'basic' && !password) {
    return null;
  }
  const shared = {
    transportId,
    displayName: record.displayName,
    securityMode: securityMode as MailTransportConfig['securityMode'],
    authMode: authMode as MailTransportConfig['authMode'],
    enabled: record.enabled,
    ...(password ? { password } : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.username === 'string' ? record.publicConfig.username : undefined)
      ? { username: normalizeOptionalText(typeof record.publicConfig.username === 'string' ? record.publicConfig.username : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultFromEmail === 'string' ? record.publicConfig.defaultFromEmail : undefined)
      ? { defaultFromEmail: normalizeOptionalText(typeof record.publicConfig.defaultFromEmail === 'string' ? record.publicConfig.defaultFromEmail : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultFromName === 'string' ? record.publicConfig.defaultFromName : undefined)
      ? { defaultFromName: normalizeOptionalText(typeof record.publicConfig.defaultFromName === 'string' ? record.publicConfig.defaultFromName : undefined)! }
      : {}),
    ...(normalizeOptionalText(typeof record.publicConfig.defaultReplyToEmail === 'string' ? record.publicConfig.defaultReplyToEmail : undefined)
      ? { defaultReplyToEmail: normalizeOptionalText(typeof record.publicConfig.defaultReplyToEmail === 'string' ? record.publicConfig.defaultReplyToEmail : undefined)! }
      : {}),
    ...(toOptionalMailTransportNumber(record.publicConfig.maxBatchSize)
      ? { maxBatchSize: toOptionalMailTransportNumber(record.publicConfig.maxBatchSize)! }
      : {}),
    ...(toOptionalMailTransportNumber(record.publicConfig.rateLimitPerMinute)
      ? { rateLimitPerMinute: toOptionalMailTransportNumber(record.publicConfig.rateLimitPerMinute)! }
      : {}),
    health: {
      visibleStatus: record.visibleStatus,
      ...(record.lastCheckedAt ? { lastCheckedAt: record.lastCheckedAt } : {}),
      ...(record.lastCheckStatus ? { lastCheckStatus: record.lastCheckStatus } : {}),
      ...(record.lastCheckErrorCode ? { lastCheckErrorCode: record.lastCheckErrorCode } : {}),
      ...(record.lastCheckErrorMessage ? { lastCheckErrorMessage: record.lastCheckErrorMessage } : {}),
    },
  } as const;

  if (transportType === 'smtp') {
    const host = normalizeOptionalText(typeof record.publicConfig.host === 'string' ? record.publicConfig.host : undefined);
    const port = toOptionalMailTransportNumber(record.publicConfig.port);
    return host && port ? { ...shared, transportType: 'smtp', host, port } : null;
  }

  const endpoint = normalizeOptionalText(typeof record.publicConfig.endpoint === 'string' ? record.publicConfig.endpoint : undefined);
  const mode = normalizeOptionalText(typeof record.publicConfig.mode === 'string' ? record.publicConfig.mode : undefined);
  return endpoint && mode ? { ...shared, transportType: 'provider_api', endpoint, mode } : null;
};

const loadSelectedWasteSupabaseRecord = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<ExternalInterfaceRecord | null> => {
  if (deps.listInterfaceRecords) {
    const records = await deps.listInterfaceRecords(instanceId);
    return (
      records.find((record) => record.typeKey === 'supabase' && record.publicConfig.wasteManagementSelected === true)
      ?? records.find((record) => record.typeKey === 'supabase' && record.isDefault)
      ?? records.find((record) => record.typeKey === 'supabase')
      ?? null
    );
  }
  return (await deps.loadDefaultInterfaceRecord?.(instanceId, 'supabase')) ?? null;
};

const loadWasteEmailReminderSettings = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<{
  readonly config: WasteManagementEmailReminderConfig;
  readonly unsubscribeSigningSecret?: string;
} | null> => {
  const selectedSupabase = await loadSelectedWasteSupabaseRecord(deps, instanceId);
  const config = selectedSupabase ? readWasteManagementEmailReminderConfig(selectedSupabase.publicConfig) ?? null : null;
  if (!selectedSupabase || !config) {
    return null;
  }
  return {
    config,
    unsubscribeSigningSecret: readWasteManagementEmailReminderSigningSecret(selectedSupabase.publicConfig),
  };
};

const loadMailTransportConfigs = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string
): Promise<ReadonlyMap<string, MailTransportConfig>> => {
  if (deps.listInterfaceRecords) {
    const records = await deps.listInterfaceRecords(instanceId);
    return new Map(
      records
        .filter((record) => record.typeKey === 'mail_transport')
        .map(readMailTransportConfigFromRecord)
        .flatMap((record) => (record ? [[record.transportId, record] as const] : []))
    );
  }

  const fallback = await deps.loadDefaultInterfaceRecord?.(instanceId, 'mail_transport');
  const config = fallback ? readMailTransportConfigFromRecord(fallback) : null;
  return new Map(config ? [[config.transportId, config] as const] : []);
};

const buildUnsubscribeUrl = (
  config: WasteManagementEmailReminderConfig,
  input: {
    readonly subscriptionId: string;
    readonly unsubscribeTokenHash: string;
    readonly secret: string;
  }
): string => {
  const url = new URL(config.unsubscribePath, config.publicBaseUrl);
  url.searchParams.set(
    'token',
    createWasteManagementUnsubscribeToken({
      subscriptionId: input.subscriptionId,
      unsubscribeTokenHash: input.unsubscribeTokenHash,
      secret: input.secret,
    })
  );
  return url.toString();
};

const matchSelectionLocations = (
  locations: readonly WasteCollectionLocationRecord[],
  subscription: {
    readonly regionId?: string;
    readonly cityId: string;
    readonly streetId: string;
    readonly houseNumberId?: string;
  }
): readonly WasteCollectionLocationRecord[] =>
  locations.filter((location) => {
    if (!location.active || location.cityId !== subscription.cityId) {
      return false;
    }
    if (subscription.regionId) {
      if (location.regionId !== undefined && location.regionId !== subscription.regionId) {
        return false;
      }
    } else if (location.regionId !== undefined) {
      return false;
    }
    if (subscription.streetId === 'all') {
      return location.streetId === undefined;
    }
    if (location.streetId !== undefined && location.streetId !== subscription.streetId) {
      return false;
    }
    if (subscription.houseNumberId && location.houseNumberId !== undefined && location.houseNumberId !== subscription.houseNumberId) {
      return false;
    }
    if (!subscription.houseNumberId && location.houseNumberId !== undefined) {
      return false;
    }
    return true;
  });

const buildReminderDispatchPayload = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly subscriptionId: string;
  readonly email: string;
  readonly locationLabel: string;
  readonly fraction: WasteFractionRecord;
  readonly pickupDate: string;
  readonly unsubscribeTokenHash: string;
  readonly unsubscribeTokenSecret: string;
}): MailDispatchPayload => {
  const unsubscribeUrl = buildUnsubscribeUrl(input.config, {
    subscriptionId: input.subscriptionId,
    unsubscribeTokenHash: input.unsubscribeTokenHash,
    secret: input.unsubscribeTokenSecret,
  });
  const pickupDateLabel = formatPickupDateLabel(input.pickupDate);
  const values = {
    fractionName: input.fraction.name,
    locationLabel: input.locationLabel,
    pickupDate: pickupDateLabel,
    unsubscribeUrl,
  } as const;

  return {
    orderId: input.subscriptionId,
    transportId: input.config.transportId,
    messageKind: 'transactional',
    templateKey: 'waste.email-reminder.reminder',
    locale: 'de-DE',
    addresses: [
      { kind: 'to', email: input.email },
      ...(input.config.replyToEmail ? [{ kind: 'reply_to' as const, email: input.config.replyToEmail }] : []),
    ],
    templatePayload: {
      subject: renderTemplate(input.config.reminderSubjectTemplate, values),
      introText: renderTemplate(input.config.reminderIntroTemplate, values),
      listIntroText: renderTemplate(input.config.reminderListIntroTemplate ?? '', values),
      outroText: input.config.reminderOutroText ?? '',
      reasonText: renderTemplate(input.config.reminderReasonText ?? '', values),
      unsubscribeLabel: input.config.unsubscribeLinkLabel,
      unsubscribeUrl,
      locationLabel: input.locationLabel,
      pickupDate: pickupDateLabel,
      fractionName: input.fraction.name,
      privacyPolicyUrl: input.config.privacyPolicyUrl,
      imprintUrl: input.config.imprintUrl,
      ...(input.config.serviceLabel ? { serviceLabel: input.config.serviceLabel } : {}),
    },
    tags: ['waste-management', 'email-reminder', 'reminder'],
    metadata: {
      module: 'waste-management',
      flow: 'public-email-reminder-delivery',
      subscriptionId: input.subscriptionId,
      fractionId: input.fraction.id,
      pickupDate: input.pickupDate,
    },
  };
};

const normalizeMailTextLine = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const joinMailTextSections = (sections: readonly (string | undefined)[]): string =>
  sections
    .filter((section): section is string => Boolean(normalizeMailTextLine(section)))
    .map((section) => section.trim())
    .join('\n\n');

const mapPayloadAddresses = (payload: MailDispatchPayload): Readonly<Record<'to' | 'cc' | 'bcc' | 'replyTo', readonly MailDispatchMessageAddress[]>> => {
  const to: MailDispatchMessageAddress[] = [];
  const cc: MailDispatchMessageAddress[] = [];
  const bcc: MailDispatchMessageAddress[] = [];
  const replyTo: MailDispatchMessageAddress[] = [];

  for (const address of payload.addresses) {
    const nextAddress = {
      email: address.email,
      ...(address.displayName ? { displayName: address.displayName } : {}),
    } as const;
    if (address.kind === 'to') {
      to.push(nextAddress);
      continue;
    }
    if (address.kind === 'cc') {
      cc.push(nextAddress);
      continue;
    }
    if (address.kind === 'bcc') {
      bcc.push(nextAddress);
      continue;
    }
    if (address.kind === 'reply_to') {
      replyTo.push(nextAddress);
    }
  }

  return { to, cc, bcc, replyTo };
};

const resolveReminderFromAddress = (
  config: WasteManagementEmailReminderConfig,
  transport: MailTransportConfig
): MailDispatchMessageAddress => ({
  email: config.fromEmail || transport.defaultFromEmail || '',
  displayName: config.fromName || transport.defaultFromName || undefined,
});

const resolveReminderReplyToAddresses = (
  config: WasteManagementEmailReminderConfig,
  transport: MailTransportConfig,
  payload: MailDispatchPayload
): readonly MailDispatchMessageAddress[] | undefined => {
  const payloadAddresses = mapPayloadAddresses(payload).replyTo;
  if (payloadAddresses.length > 0) {
    return payloadAddresses;
  }
  const fallbackEmail = config.replyToEmail || transport.defaultReplyToEmail;
  if (!fallbackEmail) {
    return undefined;
  }
  return [{ email: fallbackEmail }];
};

const buildDoiDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  const { templatePayload } = input.payload;
  const serviceLabel = normalizeMailTextLine(templatePayload.serviceLabel ?? input.config.serviceLabel);
  const dataControllerLabel = normalizeMailTextLine(templatePayload.dataControllerLabel ?? input.config.dataControllerLabel);
  const templateValues = {
    confirmUrl: templatePayload.confirmUrl ?? '',
    locationLabel: templatePayload.locationLabel ?? '',
    privacyPolicyUrl: templatePayload.privacyPolicyUrl ?? '',
    imprintUrl: templatePayload.imprintUrl ?? '',
    serviceLabel: serviceLabel ?? '',
    dataControllerLabel: dataControllerLabel ?? '',
  } as const;
  const text = joinMailTextSections([
    normalizeMailTextLine(input.config.doiPreheader) ? renderTemplate(input.config.doiPreheader!, templateValues) : undefined,
    renderTemplate(input.config.doiIntroText, templateValues),
    normalizeMailTextLine(templatePayload.locationLabel) ? `Ort: ${templatePayload.locationLabel}` : undefined,
    input.config.doiButtonLabel ? `${input.config.doiButtonLabel}: ${templatePayload.confirmUrl}` : templatePayload.confirmUrl,
    normalizeMailTextLine(input.config.doiFallbackText) ? renderTemplate(input.config.doiFallbackText!, templateValues) : undefined,
    normalizeMailTextLine(input.config.doiExpiryNoticeText) ? renderTemplate(input.config.doiExpiryNoticeText!, templateValues) : undefined,
    serviceLabel ? `Service: ${serviceLabel}` : undefined,
    dataControllerLabel ? `Verantwortlich: ${dataControllerLabel}` : undefined,
    `Datenschutz: ${templatePayload.privacyPolicyUrl}`,
    `Impressum: ${templatePayload.imprintUrl}`,
  ]);
  const addresses = mapPayloadAddresses(input.payload);

  return {
    from: resolveReminderFromAddress(input.config, input.transport),
    to: addresses.to,
    ...(addresses.cc.length > 0 ? { cc: addresses.cc } : {}),
    ...(addresses.bcc.length > 0 ? { bcc: addresses.bcc } : {}),
    ...(resolveReminderReplyToAddresses(input.config, input.transport, input.payload)
      ? { replyTo: resolveReminderReplyToAddresses(input.config, input.transport, input.payload) }
      : {}),
    subject: renderTemplate(input.config.doiSubjectTemplate, templateValues),
    text,
  };
};

const buildReminderDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  const { templatePayload } = input.payload;
  const bulletLine = normalizeMailTextLine(templatePayload.fractionName)
    ? `- ${templatePayload.fractionName}${normalizeMailTextLine(templatePayload.pickupDate) ? ` (${templatePayload.pickupDate})` : ''}`
    : undefined;
  const serviceLabel = normalizeMailTextLine(templatePayload.serviceLabel ?? input.config.serviceLabel);
  const text = joinMailTextSections([
    templatePayload.introText,
    templatePayload.listIntroText,
    bulletLine,
    templatePayload.outroText,
    templatePayload.reasonText,
    `${templatePayload.unsubscribeLabel}: ${templatePayload.unsubscribeUrl}`,
    `Datenschutz: ${templatePayload.privacyPolicyUrl}`,
    `Impressum: ${templatePayload.imprintUrl}`,
    serviceLabel ? `Service: ${serviceLabel}` : undefined,
  ]);
  const addresses = mapPayloadAddresses(input.payload);

  return {
    from: resolveReminderFromAddress(input.config, input.transport),
    to: addresses.to,
    ...(addresses.cc.length > 0 ? { cc: addresses.cc } : {}),
    ...(addresses.bcc.length > 0 ? { bcc: addresses.bcc } : {}),
    ...(resolveReminderReplyToAddresses(input.config, input.transport, input.payload)
      ? { replyTo: resolveReminderReplyToAddresses(input.config, input.transport, input.payload) }
      : {}),
    subject: templatePayload.subject,
    text,
  };
};

const buildDispatchMessage = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly transport: MailTransportConfig;
  readonly payload: MailDispatchPayload;
}): MailDispatchMessage => {
  if (input.payload.templateKey === 'waste.email-reminder.doi') {
    return buildDoiDispatchMessage(input);
  }
  return buildReminderDispatchMessage(input);
};

const resolveBoundWasteSchemaName = (configuredSchemaName: string, requestedSchema: string | undefined): string => {
  const normalizedRequestedSchema = normalizeOptionalText(requestedSchema);
  if (!normalizedRequestedSchema) {
    return configuredSchemaName;
  }
  if (normalizedRequestedSchema !== configuredSchemaName) {
    throw new Error(`invalid_waste_schema_target:${normalizedRequestedSchema}`);
  }
  return configuredSchemaName;
};

const createInitializeDataSourceOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['initializeDataSource'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const dataSource = await resolveRuntimeDataSource(deps, instanceId);
  const schemaName = resolveBoundWasteSchemaName(dataSource.schemaName, input.targetSchema);
  const connectionCheck = await runWasteConnectionCheck({
    dataSource,
    probe: async (resolved) => {
      const pool = (deps.createPool ?? defaultCreatePool)(resolved.databaseUrl);
      try {
        const client = await pool.connect();
        client.release();
      } finally {
        await pool.end();
      }
    },
    now: deps.now,
  });
  const schemaInspection = await withWasteClient(deps, instanceId, async ({ client, dataSource: resolved }) =>
    inspectWasteSchema(client, resolveBoundWasteSchemaName(resolved.schemaName, schemaName))
  );
  return buildOperationSummary(startedAt, {
    operation: 'initialize-data-source',
    mode: 'executed',
    connectionCheck,
    schemaInspection,
  });
};

const createApplyMigrationsOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['applyMigrations'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ client, dataSource }) => {
    const schemaName = resolveBoundWasteSchemaName(dataSource.schemaName, input.targetSchema);
    const statements = applySchemaStatements(schemaName);
    for (const statement of statements) {
      await client.query(statement);
    }
    return {
      operation: 'apply-migrations',
      mode: 'executed',
      requestedByVersion: normalizeOptionalText(input.requestedByVersion),
      schemaInspection: await inspectWasteSchema(client, schemaName),
      appliedStatementCount: statements.length,
    };
  });
  return buildOperationSummary(startedAt, details);
};

const createImportDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['importData'] => async (instanceId, input, progressReporter) => {
  const startedAt = Date.now();
  const parsedLocationTourPickupDates =
    input.importProfileId === wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
      ? await parseLocationTourPickupDateImport(deps, {
          sourceFormat: input.sourceFormat,
          blobRef: input.blobRef,
          delimiterOverride: input.delimiterOverride,
        })
      : undefined;
  const rows =
    input.importProfileId === wasteManagementOperationsContract.importProfileIds.locationTourPickupDates
      ? []
      : await parseImportRows(deps, {
          profileId: input.importProfileId,
          sourceFormat: input.sourceFormat,
          blobRef: input.blobRef,
        });
  const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
    const catalogEntry = getWasteManagementImportCatalogEntry(input.importProfileId);
    if (!catalogEntry) {
      throw new Error(`unknown_import_profile:${input.importProfileId}`);
    }
    if (parsedLocationTourPickupDates) {
      const preview = await previewLocationTourPickupDateImport(repository, parsedLocationTourPickupDates);
      if (input.dryRun) {
        return {
          operation: 'import-data',
          mode: 'executed',
          importProfileId: input.importProfileId,
          sourceFormat: input.sourceFormat,
          dryRun: true,
          rowCount: preview.validRowCount,
          skippedRows: preview.invalidRowCount,
          errorCount: preview.errors.length,
          preview,
        };
      }
    }
    if (input.dryRun) {
      return {
        operation: 'import-data',
        mode: 'executed',
        importProfileId: input.importProfileId,
        sourceFormat: input.sourceFormat,
        dryRun: true,
        rowCount: rows.length,
      };
    }
    return {
      operation: 'import-data',
      mode: 'executed',
      importProfileId: input.importProfileId,
      sourceFormat: input.sourceFormat,
      dryRun: false,
      ...(await executeImport(repository, {
        profileId: input.importProfileId,
        rows,
        parsedLocationTourPickupDates,
        reportProgress: progressReporter?.reportProgress,
      })),
    };
  });
  return buildOperationSummary(startedAt, details);
};

const createSeedDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['seedData'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ repository }) => {
    if (input.seedKey !== 'baseline') {
      throw new Error(`unsupported_seed_key:${input.seedKey}`);
    }
    await seedWasteBaseline(repository);
    return {
      operation: 'seed-data',
      mode: 'executed',
      seedKey: input.seedKey,
      seededEntityCount: Object.keys(baselineIds).length,
    };
  });
  return buildOperationSummary(startedAt, details);
};

const createSyncMainserverOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['syncMainserver'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await runWasteManagementMainserverSyncForInstance({
    instanceId,
    runtimeDeps: deps,
    syncInput: input,
  });
  return buildOperationSummary(startedAt, {
    operation: 'sync-mainserver',
    mode: 'executed',
    studioItemCount: details.studioItemCount,
    mainserverItemCount: details.mainserverItemCount,
    createCount: details.createCount,
    createBatchCount: details.createBatchCount,
    deleteCount: details.deleteCount,
    deleteByIdCount: details.deleteByIdCount,
    deleteByValueCount: details.deleteByValueCount,
    errorCount: details.errorCount,
  });
};

const createSyncWasteTypesOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['syncWasteTypes'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const details = await withWasteClient(deps, instanceId, async ({ client, repository }) => {
    await client.query(buildWasteFractionShortLabelBackfillStatement('waste_fractions'));
    const fractions = await repository.listWasteFractions();
    const artifact = await buildWasteTypesStaticContent(fractions);
    const writeResult = await createOrUpdateSvaMainserverStaticContent({
      instanceId,
      keycloakSubject: normalizeOptionalText(input.keycloakSubject) ?? 'plugin-operation-runtime',
      activeOrganizationId: normalizeOptionalText(input.activeOrganizationId),
      staticContent: {
        name: artifact.name,
        content: artifact.content,
      },
    });

    return {
      operation: 'sync-waste-types',
      mode: 'executed',
      staticContentName: artifact.name,
      version: artifact.version,
      fractionCount: artifact.fractionCount,
      staticContentId: writeResult.id,
    };
  });

  return buildOperationSummary(startedAt, details);
};

const createMaterializeEmailRemindersOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['materializeEmailReminders'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const reminderSettings = await loadWasteEmailReminderSettings(deps, instanceId);
  if (!reminderSettings?.config.enabled) {
    return buildOperationSummary(startedAt, {
      operation: 'materialize-email-reminders',
      mode: 'skipped',
      reason: 'email_reminders_disabled',
      activeSubscriptionCount: 0,
      createdOutboxCount: 0,
      duplicateOutboxCount: 0,
      skippedPickupCount: 0,
    });
  }

  const referenceTime = input.referenceTime ? new Date(input.referenceTime) : deps.now?.() ?? new Date();
  if (Number.isNaN(referenceTime.getTime())) {
    throw new Error(`invalid_reference_time:${input.referenceTime}`);
  }
  const reminderConfig = reminderSettings.config;

  const details = await withWasteClient(deps, instanceId, async ({ client, repository, dataSource }) => {
    const unsubscribeSigningSecret = reminderSettings.unsubscribeSigningSecret ?? dataSource.databaseUrl;
    const reminderRepository = createWasteEmailReminderRepository(createSqlExecutor(client));
    const [subscriptions, fractions, tours, links, locations, pickupDates, tourDateShifts, globalDateShifts, holidayRules] =
      await Promise.all([
        reminderRepository.listActiveSubscriptions(),
        repository.listWasteFractions({ active: true }),
        repository.listWasteTours({ active: true }),
        repository.listWasteLocationTourLinks(),
        repository.listWasteCollectionLocations({ active: true }),
        repository.listWasteLocationTourPickupDates(),
        repository.listWasteTourDateShifts(),
        repository.listWasteGlobalDateShifts(),
        repository.listWasteHolidayRules(),
      ]);

    const currentYear = referenceTime.getUTCFullYear();
    const materializedPickupDates = buildMaterializedLocationTourPickupDates({
      tours,
      links,
      locationTourPickupDates: pickupDates,
      tourDateShifts,
      globalDateShifts,
      holidayRules,
      currentYear,
      nextYear: currentYear + 1,
    });

    const pickupDateByLocationFraction = new Map<string, string[]>();
    const fractionById = new Map(fractions.map((fraction) => [fraction.id, fraction] as const));
    const tourById = new Map(tours.map((tour) => [tour.id, tour] as const));
    for (const entry of materializedPickupDates) {
      const tour = tourById.get(entry.tourId);
      if (!tour) {
        continue;
      }
      for (const fractionId of tour.wasteFractionIds) {
        const key = `${entry.locationId}::${fractionId}`;
        const values = pickupDateByLocationFraction.get(key) ?? [];
        values.push(entry.pickupDate);
        pickupDateByLocationFraction.set(key, values);
      }
    }

    let createdOutboxCount = 0;
    let duplicateOutboxCount = 0;
    let skippedPickupCount = 0;
    for (const subscription of subscriptions) {
      const matchingLocations = matchSelectionLocations(locations, subscription);
      if (matchingLocations.length === 0) {
        skippedPickupCount += subscription.items.length;
        continue;
      }

      for (const item of subscription.items) {
        const fraction = fractionById.get(item.fractionId);
        const slot = fraction?.reminderConfig.email?.slots.find((candidate) => candidate.id === item.slotId);
        if (!fraction || !slot) {
          skippedPickupCount += 1;
          continue;
        }

        const reminderDates = new Set<string>();
        for (const location of matchingLocations) {
          for (const pickupDate of pickupDateByLocationFraction.get(`${location.id}::${fraction.id}`) ?? []) {
            reminderDates.add(pickupDate);
          }
        }

        for (const pickupDate of reminderDates) {
          const pickupDateValue = parseIsoDateUtc(pickupDate);
          const sendAtDate = addDaysUtc(pickupDateValue, -slot.defaultLeadDays);
          const sendAt = createUtcIsoAtHour(sendAtDate, DEFAULT_REMINDER_SEND_HOUR_UTC);
          if (new Date(sendAt).getTime() < referenceTime.getTime()) {
            skippedPickupCount += 1;
            continue;
          }
          const lookaheadBoundary = addDaysUtc(referenceTime, reminderConfig.materializationLookaheadDays);
          if (new Date(sendAt).getTime() > lookaheadBoundary.getTime()) {
            continue;
          }
          const result = await reminderRepository.enqueueOutboxEntry({
            id: randomUUID(),
            subscriptionId: subscription.id,
            messageKind: 'reminder',
            transportId: reminderConfig.transportId,
            templateKey: 'waste.email-reminder.reminder',
            sendAt,
            dedupeKey: `reminder:${subscription.id}:${fraction.id}:${slot.id}:${pickupDate}`,
            payload: buildReminderDispatchPayload({
              config: reminderConfig,
              subscriptionId: subscription.id,
              email: subscription.email,
              locationLabel: subscription.locationLabel,
              fraction,
              pickupDate,
              unsubscribeTokenHash: subscription.unsubscribeTokenHash,
              unsubscribeTokenSecret: unsubscribeSigningSecret,
            }),
          });
          if (result === 'inserted') {
            createdOutboxCount += 1;
          } else {
            duplicateOutboxCount += 1;
          }
        }
      }
    }

    return {
      operation: 'materialize-email-reminders',
      mode: 'executed',
      activeSubscriptionCount: subscriptions.length,
      createdOutboxCount,
      duplicateOutboxCount,
      skippedPickupCount,
    };
  });

  return buildOperationSummary(startedAt, details);
};

const createProcessEmailReminderOutboxOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['processEmailReminderOutbox'] => async (instanceId, input) => {
  const startedAt = Date.now();
  if (!deps.dispatchMail) {
    throw new Error('mail_dispatch_not_configured');
  }
  const reminderSettings = await loadWasteEmailReminderSettings(deps, instanceId);
  if (!reminderSettings?.config.enabled) {
    return buildOperationSummary(startedAt, {
      operation: 'process-email-reminder-outbox',
      mode: 'skipped',
      reason: 'email_reminders_disabled',
      leasedCount: 0,
      sentCount: 0,
      retryScheduledCount: 0,
      failedCount: 0,
      batchSize: 0,
    });
  }

  const referenceTime = input.referenceTime ? new Date(input.referenceTime) : deps.now?.() ?? new Date();
  if (Number.isNaN(referenceTime.getTime())) {
    throw new Error(`invalid_reference_time:${input.referenceTime}`);
  }
  const reminderConfig = reminderSettings.config;
  const transportConfigs = await loadMailTransportConfigs(deps, instanceId);
  if (transportConfigs.size === 0) {
    throw new Error(`mail_transport_not_available:${reminderConfig.transportId}`);
  }

  const requestedBatchSize = input.maxBatchSize ?? DEFAULT_OUTBOX_BATCH_SIZE;
  const transportBatchLimits = Array.from(transportConfigs.values()).map((transport) =>
    Math.min(
      transport.maxBatchSize ?? requestedBatchSize,
      transport.rateLimitPerMinute ?? requestedBatchSize
    )
  );
  const batchSize = Math.max(
    1,
    Math.min(
      requestedBatchSize,
      ...(transportBatchLimits.length > 0 ? transportBatchLimits : [requestedBatchSize])
    )
  );
  const retryDelayMinutes = Math.max(1, input.retryDelayMinutes ?? DEFAULT_OUTBOX_RETRY_DELAY_MINUTES);
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_OUTBOX_MAX_ATTEMPTS);

  const details = await withWasteClient(deps, instanceId, async ({ client }) => {
    const reminderRepository = createWasteEmailReminderRepository(createSqlExecutor(client));
    const leased = await reminderRepository.leaseDueOutboxEntries({
      now: referenceTime.toISOString(),
      limit: batchSize,
    });

    let sentCount = 0;
    let retryScheduledCount = 0;
    let failedCount = 0;
    for (const entry of leased) {
      try {
        const transport = transportConfigs.get(entry.transportId);
        if (!transport?.enabled) {
          throw new Error(`mail_transport_not_available:${entry.transportId}`);
        }
        const message = buildDispatchMessage({
          config: reminderConfig,
          transport,
          payload: entry.payload,
        });
        const result = await deps.dispatchMail!({
          instanceId,
          transport,
          payload: entry.payload,
          message,
        });
        await reminderRepository.markOutboxEntrySent({
          outboxId: entry.id,
          now: referenceTime.toISOString(),
          ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        });
        sentCount += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'mail_dispatch_failed';
        const shouldRetry = entry.attemptCount < maxAttempts;
        await reminderRepository.markOutboxEntryFailed({
          outboxId: entry.id,
          now: referenceTime.toISOString(),
          errorMessage,
          ...(shouldRetry
            ? { retryAt: new Date(referenceTime.getTime() + retryDelayMinutes * 60 * 1000).toISOString() }
            : {}),
        });
        if (shouldRetry) {
          retryScheduledCount += 1;
        } else {
          failedCount += 1;
        }
      }
    }

    return {
      operation: 'process-email-reminder-outbox',
      mode: 'executed',
      leasedCount: leased.length,
      sentCount,
      retryScheduledCount,
      failedCount,
      batchSize,
    };
  });

  return buildOperationSummary(startedAt, details);
};

const createResetDataOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['resetData'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const normalizedConfirmationToken = input.confirmationToken.trim();
  if (normalizedConfirmationToken.length === 0) {
    throw new Error('missing_reset_confirmation_token');
  }
  if (normalizedConfirmationToken !== wasteManagementOperationsContract.resetConfirmationToken) {
    throw new Error('invalid_reset_confirmation_token');
  }
  const details = await withWasteClient(deps, instanceId, async ({ client }) => {
    const tableOrder = [
      'waste_location_tour_pickup_dates',
      'waste_location_tour_links',
      'waste_tour_date_shifts',
      'waste_global_date_shifts',
      'waste_collection_locations',
      'waste_house_numbers',
      'waste_streets',
      'waste_tours',
      'waste_fractions',
      'waste_cities',
      'waste_regions',
    ] as const;
    const deletedRows: Record<string, number> = {};
    for (const tableName of tableOrder) {
      const result = await client.query(`DELETE FROM ${tableName};`);
      deletedRows[tableName] = result.rowCount ?? 0;
    }
    return {
      operation: 'reset-data',
      mode: 'executed',
      confirmationTokenLength: normalizedConfirmationToken.length,
      deletedRows,
    };
  });
  return buildOperationSummary(startedAt, details);
};

export const createWasteManagementOperationRuntime = (
  deps: WasteOperationRuntimeDeps = {}
): WasteManagementOperationRuntime => ({
  initializeDataSource: createInitializeDataSourceOperation(deps),
  applyMigrations: createApplyMigrationsOperation(deps),
  importData: createImportDataOperation(deps),
  seedData: createSeedDataOperation(deps),
  syncMainserver: createSyncMainserverOperation(deps),
  syncWasteTypes: createSyncWasteTypesOperation(deps),
  materializeEmailReminders: createMaterializeEmailRemindersOperation(deps),
  processEmailReminderOutbox: createProcessEmailReminderOutboxOperation(deps),
  resetData: createResetDataOperation(deps),
});
