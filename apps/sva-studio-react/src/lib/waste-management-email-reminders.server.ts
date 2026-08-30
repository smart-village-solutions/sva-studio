import { randomUUID } from 'node:crypto';
import { createWasteEmailReminderRepository } from '@sva/data-repositories';

import { buildMaterializedLocationTourPickupDates } from './waste-management-mainserver-sync.materialization.js';
import {
  buildOperationSummary,
  createSqlExecutor,
  withWasteClient,
} from './waste-management-operations.shared.js';
import {
  loadWasteEmailReminderSettings,
} from './waste-management-email-reminder-config.server.js';
import { loadMailTransportConfigs } from './waste-management-email-reminder-transport.server.js';
import {
  addDaysUtc,
  buildDispatchMessage,
  buildReminderDispatchPayload,
  createUtcIsoAtHour,
  matchSelectionLocations,
  parseIsoDateUtc,
} from './waste-management-email-reminder-dispatch.server.js';
import type { WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const DEFAULT_REMINDER_SEND_HOUR_UTC = 6;
const DEFAULT_OUTBOX_RETRY_DELAY_MINUTES = 15;
const DEFAULT_OUTBOX_MAX_ATTEMPTS = 5;
const DEFAULT_OUTBOX_BATCH_SIZE = 25;

const countOverdueReminderRefresh = (refreshed: boolean): Readonly<{
  duplicateOutboxCount: number;
  skippedPickupCount: number;
}> => refreshed
  ? { duplicateOutboxCount: 1, skippedPickupCount: 0 }
  : { duplicateOutboxCount: 0, skippedPickupCount: 1 };

export const createMaterializeEmailRemindersOperation = (
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
    const [subscriptions, fractions, tours, links, locations, pickupDates, tourAssignments, tourDateShifts, globalDateShifts, holidayRules] =
      await Promise.all([
        reminderRepository.listActiveSubscriptions(),
        repository.listWasteFractions({ active: true }),
        repository.listWasteTours({ active: true }),
        repository.listWasteLocationTourLinks(),
        repository.listWasteCollectionLocations({ active: true }),
        repository.listWasteLocationTourPickupDates(),
        repository.listWasteTourAssignments(),
        repository.listWasteTourDateShifts(),
        repository.listWasteGlobalDateShifts(),
        repository.listWasteHolidayRules(),
      ]);

    const currentYear = referenceTime.getUTCFullYear();
    const materializedPickupDates = buildMaterializedLocationTourPickupDates({
      tours,
      links,
      locationTourPickupDates: pickupDates,
      tourAssignments,
      tourDateShifts,
      globalDateShifts,
      holidayRules,
      currentYear,
      nextYear: currentYear + 1,
    });

    const pickupsByLocationFraction = new Map<
      string,
      Array<Readonly<{ pickupDate: string; hints: readonly string[] }>>
    >();
    const fractionById = new Map(fractions.map((fraction) => [fraction.id, fraction] as const));
    const tourById = new Map(tours.map((tour) => [tour.id, tour] as const));
    for (const entry of materializedPickupDates) {
      const tour = tourById.get(entry.tourId);
      if (!tour) {
        continue;
      }
      for (const fractionId of tour.wasteFractionIds) {
        const key = `${entry.locationId}::${fractionId}`;
        const values = pickupsByLocationFraction.get(key) ?? [];
        values.push({
          pickupDate: entry.pickupDate,
          hints: [tour.description, entry.note].filter(
            (hint): hint is string => typeof hint === 'string' && hint.trim().length > 0
          ),
        });
        pickupsByLocationFraction.set(key, values);
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

        const reminderHintsByDate = new Map<string, Set<string>>();
        for (const location of matchingLocations) {
          for (const pickup of pickupsByLocationFraction.get(`${location.id}::${fraction.id}`) ?? []) {
            const hints = reminderHintsByDate.get(pickup.pickupDate) ?? new Set<string>();
            for (const hint of pickup.hints) {
              hints.add(hint.trim());
            }
            reminderHintsByDate.set(pickup.pickupDate, hints);
          }
        }

        for (const [pickupDate, hints] of reminderHintsByDate) {
          const pickupDateValue = parseIsoDateUtc(pickupDate);
          const sendAtDate = addDaysUtc(pickupDateValue, -slot.defaultLeadDays);
          const sendAt = createUtcIsoAtHour(sendAtDate, DEFAULT_REMINDER_SEND_HOUR_UTC);
          const outboxEntry = {
            subscriptionId: subscription.id,
            messageKind: 'reminder' as const,
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
              hints: [...hints],
              unsubscribeTokenHash: subscription.unsubscribeTokenHash,
              unsubscribeTokenSecret: unsubscribeSigningSecret,
            }),
          };
          if (new Date(sendAt).getTime() < referenceTime.getTime()) {
            const refreshed = await reminderRepository.refreshPendingOutboxEntry(outboxEntry);
            const refreshCounts = countOverdueReminderRefresh(refreshed);
            duplicateOutboxCount += refreshCounts.duplicateOutboxCount;
            skippedPickupCount += refreshCounts.skippedPickupCount;
            continue;
          }
          const lookaheadBoundary = addDaysUtc(referenceTime, reminderConfig.materializationLookaheadDays);
          if (new Date(sendAt).getTime() > lookaheadBoundary.getTime()) {
            continue;
          }
          const result = await reminderRepository.enqueueOutboxEntry({
            id: randomUUID(),
            ...outboxEntry,
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

export const createProcessEmailReminderOutboxOperation = (
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
