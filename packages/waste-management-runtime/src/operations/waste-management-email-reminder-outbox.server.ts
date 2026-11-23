import type { MailTransportConfig } from '@sva/core';
import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import {
  createWasteEmailReminderRepository,
  type WasteEmailReminderOutboxLease,
  type WasteEmailReminderRepository,
} from '../repositories.js';

import {
  MAIL_TRANSPORT_NOT_AVAILABLE,
  REMINDER_OUTCOME_UNKNOWN,
} from '../repositories/email-reminders.outbox-dispatch.js';
import { loadWasteEmailReminderSettings } from './waste-management-email-reminder-config.server.js';
import { buildDispatchMessage } from './waste-management-email-reminder-dispatch.server.js';
import { loadMailTransportConfigs } from './waste-management-email-reminder-transport.server.js';
import { createMaterializeEmailRemindersOperation } from './waste-management-email-reminders.server.js';
import { buildOperationSummary, createSqlExecutor, withWasteClient } from './waste-management-operations.shared.js';
import type { SqlClient, WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const DEFAULT_OUTBOX_RETRY_DELAY_MINUTES = 15;
const DEFAULT_OUTBOX_MAX_ATTEMPTS = 5;
const DEFAULT_OUTBOX_BATCH_SIZE = 25;
const OUTBOX_DISPATCH_TIMEOUT_MS = 30_000;

type LeasedDispatch = Readonly<{
  client: SqlClient;
  repository: WasteEmailReminderRepository;
  instanceId: string;
  config: WasteManagementEmailReminderConfig;
  entry: WasteEmailReminderOutboxLease;
  leasedAt: string;
  transport: MailTransportConfig | undefined;
  dispatchMail: NonNullable<WasteOperationRuntimeDeps['dispatchMail']>;
  maxAttempts: number;
  retryAt: string;
}>;

const sendOutboxMessage = async ({
  instanceId,
  config,
  entry,
  transport,
  dispatchMail,
}: LeasedDispatch): Promise<{ providerMessageId?: string } | { errorMessage: string }> => {
  if (!transport?.enabled) return { errorMessage: MAIL_TRANSPORT_NOT_AVAILABLE };

  const signal = AbortSignal.timeout(OUTBOX_DISPATCH_TIMEOUT_MS);
  let invokingProvider = false;
  try {
    const message = buildDispatchMessage({ config, transport, payload: entry.payload });
    invokingProvider = true;
    const { providerMessageId } = await dispatchMail({
      instanceId,
      transport,
      payload: entry.payload,
      message,
      signal,
    });
    return { providerMessageId };
  } catch {
    const outcomeUnknown = signal.aborted || (entry.messageKind === 'reminder' && invokingProvider);
    return { errorMessage: outcomeUnknown ? REMINDER_OUTCOME_UNKNOWN : 'mail_dispatch_failed' };
  }
};

const recordDispatchResult = async (input: LeasedDispatch) => {
  const { repository, entry, leasedAt, maxAttempts, retryAt } = input;
  const identity = { outboxId: entry.id, now: leasedAt, leasedAt };
  const result = await sendOutboxMessage(input);
  if ('errorMessage' in result) {
    const retryable = entry.messageKind === 'reminder'
      ? result.errorMessage === MAIL_TRANSPORT_NOT_AVAILABLE
      : result.errorMessage !== REMINDER_OUTCOME_UNKNOWN;
    const shouldRetry = retryable && entry.attemptCount < maxAttempts;
    const recorded = await repository.markOutboxEntryFailed({
      ...identity,
      errorMessage: result.errorMessage,
      ...(shouldRetry ? { retryAt } : {}),
    });
    if (recorded) return shouldRetry ? 'retryScheduledCount' : 'failedCount';
  } else if (await repository.markOutboxEntrySent({
    ...identity,
    providerMessageId: result.providerMessageId,
  })) {
    return 'sentCount';
  }
  return undefined;
};

const dispatchLeasedEntry = async (input: LeasedDispatch) => {
  const { client, repository, entry, leasedAt } = input;
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '45s'");
    const claimed = await repository.claimOutboxEntryForDispatch({ outboxId: entry.id, leasedAt });
    const outcome = claimed ? await recordDispatchResult(input) : undefined;
    await client.query('COMMIT');
    return outcome;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

export const createProcessEmailReminderOutboxOperation = (
  deps: WasteOperationRuntimeDeps
): WasteManagementOperationRuntime['processEmailReminderOutbox'] => async (instanceId, input) => {
  const startedAt = Date.now();
  const reminderSettings = await loadWasteEmailReminderSettings(deps, instanceId);
  if (!reminderSettings) {
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
  const cleanup = await withWasteClient(deps, instanceId, async ({ client }) => {
    const reminderRepository = createWasteEmailReminderRepository(createSqlExecutor(client));
    const expired = await reminderRepository.deleteExpiredPendingSubscriptions({
      now: referenceTime.toISOString(),
    });
    const unresolvedReminderCount = await reminderRepository.markUnresolvedReminderDeliveries({
      now: (deps.now?.() ?? new Date()).toISOString(),
    });
    return { ...expired, unresolvedReminderCount };
  });
  if (!reminderConfig.enabled) {
    return buildOperationSummary(startedAt, {
      operation: 'process-email-reminder-outbox',
      mode: 'skipped',
      reason: 'email_reminders_disabled',
      leasedCount: 0,
      sentCount: 0,
      retryScheduledCount: 0,
      failedCount: 0,
      batchSize: 0,
      ...cleanup,
    });
  }
  const { dispatchMail } = deps;
  if (!dispatchMail) {
    throw new Error('mail_dispatch_not_configured');
  }
  const shouldMaterialize = input.materialize === 'if-reminder-due'
    ? await withWasteClient(deps, instanceId, async ({ client }) =>
        createWasteEmailReminderRepository(createSqlExecutor(client)).hasDueReminderOutboxEntries({
          now: referenceTime.toISOString(),
        })
      )
    : input.materialize !== false;
  if (shouldMaterialize) {
    await createMaterializeEmailRemindersOperation(deps)(instanceId, {
      operation: 'materialize-email-reminders',
      referenceTime: referenceTime.toISOString(),
    });
  }
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
      ...transportBatchLimits
    )
  );
  const retryDelayMinutes = Math.max(1, input.retryDelayMinutes ?? DEFAULT_OUTBOX_RETRY_DELAY_MINUTES);
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_OUTBOX_MAX_ATTEMPTS);

  const details = await withWasteClient(deps, instanceId, async ({ client }) => {
    const reminderRepository = createWasteEmailReminderRepository(createSqlExecutor(client));
    let leasedCount = 0;
    const counts = { sentCount: 0, retryScheduledCount: 0, failedCount: 0 };
    while (leasedCount < batchSize) {
      // Leave later orders pending until the worker is ready to dispatch them.
      const leasedAt = (deps.now?.() ?? new Date()).toISOString();
      const [entry] = await reminderRepository.leaseDueOutboxEntries({
        now: referenceTime.toISOString(),
        leasedAt,
        limit: 1,
      });
      if (!entry) break;
      leasedCount += 1;
      const outcome = await dispatchLeasedEntry({
        client,
        repository: reminderRepository,
        instanceId,
        config: reminderConfig,
        entry,
        leasedAt,
        transport: transportConfigs.get(entry.transportId),
        dispatchMail,
        maxAttempts,
        retryAt: new Date(
          Math.max(referenceTime.getTime(), Date.parse(leasedAt)) + retryDelayMinutes * 60_000
        ).toISOString(),
      });
      if (outcome) counts[outcome] += 1;
    }

    return {
      operation: 'process-email-reminder-outbox',
      mode: 'executed',
      leasedCount,
      ...counts,
      batchSize,
      ...cleanup,
    };
  });

  return buildOperationSummary(startedAt, details);
};
