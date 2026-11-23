import { randomUUID } from 'node:crypto';
import type { WasteCollectionLocationRecord, WasteFractionRecord } from '@sva/waste-management-contracts';
import {
  createWasteEmailReminderRepository,
  type WasteEmailReminderActiveSubscription,
  type WasteEmailReminderOutboxEntryInput,
  type WasteEmailReminderRepository,
} from '../repositories.js';

import type { WasteEmailReminderPlanningOrder } from '../repositories/email-reminders.js';
import { buildMaterializedLocationTourPickupDates } from './waste-management-mainserver-sync.materialization.js';
import {
  buildOperationSummary,
  createSqlExecutor,
  withWasteClient,
} from './waste-management-operations.shared.js';
import {
  loadWasteEmailReminderSettings,
} from './waste-management-email-reminder-config.server.js';
import { buildReminderDispatchPayload } from './waste-management-email-reminder-dispatch.server.js';
import {
  addDaysUtc,
  createUtcIsoAtHour,
  groupReminderMembers,
  matchSelectionLocations,
  parseIsoDateUtc,
  reminderMemberDedupeKey,
  selectUnreservedReminderGroups,
} from './waste-management-email-reminder-planning.js';
import type { SqlClient, WasteManagementOperationRuntime, WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const DEFAULT_REMINDER_SEND_HOUR_UTC = 6;

const scheduleReminder = async (
  repository: WasteEmailReminderRepository,
  entry: Omit<WasteEmailReminderOutboxEntryInput, 'id'>,
  referenceTime: Date,
  lookaheadDays: number
): Promise<'created' | 'duplicate' | 'skipped' | 'outside-lookahead'> => {
  const sendAt = new Date(entry.sendAt);
  if (sendAt.getTime() < referenceTime.getTime()) {
    if (await repository.refreshPendingOutboxEntry(entry)) return 'duplicate';
    if (entry.sendAt.slice(0, 10) !== referenceTime.toISOString().slice(0, 10)) return 'skipped';
    const result = await repository.enqueueOutboxEntry({
      id: randomUUID(),
      ...entry,
      sendAt: referenceTime.toISOString(),
    });
    return result === 'inserted' ? 'created' : 'duplicate';
  }
  if (sendAt.getTime() > addDaysUtc(referenceTime, lookaheadDays).getTime())
    return 'outside-lookahead';
  const result = await repository.enqueueOutboxEntry({ id: randomUUID(), ...entry });
  return result === 'inserted' ? 'created' : 'duplicate';
};

/** Serialize reminder planners and fraction deletion without locking ordinary tour edits. */
const withReminderPlanningLock = async <T>(client: SqlClient, work: () => Promise<T>): Promise<T> => {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('waste-fraction-deletion'))");
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

type PickupDatesByLocationFraction = ReadonlyMap<
  string,
  readonly Readonly<{ pickupDate: string; hints: readonly string[] }>[]
>;

const planSubscriptionPickupDates = (
  subscription: WasteEmailReminderActiveSubscription,
  locations: readonly WasteCollectionLocationRecord[],
  fractionById: ReadonlyMap<string, WasteFractionRecord>,
  pickupsByLocationFraction: PickupDatesByLocationFraction
) => {
  let skippedPickupCount = 0;
  const matchingLocations = matchSelectionLocations(locations, subscription);
  if (matchingLocations.length === 0) {
    return { planned: [], skippedPickupCount: subscription.items.length };
  }

  const planned: Array<Parameters<typeof groupReminderMembers>[0][number]> = [];
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
      planned.push({
        subscriptionId: subscription.id,
        pickupDate,
        originalSendAt: createUtcIsoAtHour(sendAtDate, DEFAULT_REMINDER_SEND_HOUR_UTC),
        fraction,
        slotId: slot.id,
        hints: [...hints],
      });
    }
  }
  return { planned, skippedPickupCount };
};

const collectReplaceableReminderKeys = (
  existing: readonly WasteEmailReminderPlanningOrder[],
  memberKeys: ReadonlySet<string>,
  validDedupeKeys: Set<string>
) => {
  const replaceable = new Set<string>();
  for (const order of existing) {
    if (order.status !== 'pending') continue;
    const members = order.memberKeys ?? [order.dedupeKey];
    if (order.attemptCount === 0 || order.requiresReplan) {
      replaceable.add(order.dedupeKey);
      for (const member of members) replaceable.add(member);
    } else if (members.some((member) => memberKeys.has(member))) {
      validDedupeKeys.add(order.dedupeKey);
    }
  }
  return replaceable;
};

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

  const details = await withWasteClient(deps, instanceId, async ({ client, repository, dataSource }) => withReminderPlanningLock(client, async () => {
    const unsubscribeSigningSecret = reminderSettings.unsubscribeSigningSecret ?? dataSource.databaseUrl;
    const reminderRepository = createWasteEmailReminderRepository(createSqlExecutor(client));
    const [subscriptions, fractions, tours, links, locations, pickupDates, tourAssignments, tourDateShifts, globalDateShifts, holidayRules] =
      await Promise.all([
        reminderRepository.listActiveSubscriptions(),
        repository.listWasteFractions({ active: true }),
        repository.listWasteTours({ status: 'published' }),
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
    const validDedupeKeys = new Set<string>();
    for (const subscription of subscriptions) {
      const plan = planSubscriptionPickupDates(
        subscription,
        locations,
        fractionById,
        pickupsByLocationFraction
      );
      skippedPickupCount += plan.skippedPickupCount;
      const { planned } = plan;
      if (planned.length === 0) continue;

      const groups = groupReminderMembers(planned);
      const memberKeys = new Set(planned.map((member) =>
        reminderMemberDedupeKey(subscription.id, member.pickupDate, member)
      ));
      const existing = await reminderRepository.loadLockedReminderPlanningOrders({
        subscriptionId: subscription.id,
        pickupDates: [...new Set(planned.map((member) => member.pickupDate))],
        dedupeKeys: [...memberKeys, ...groups.map((group) => group.dedupeKey)],
      });
      if (!existing) continue;
      const replaceable = collectReplaceableReminderKeys(existing, memberKeys, validDedupeKeys);

      const sendableGroups = selectUnreservedReminderGroups(groups, existing);
      duplicateOutboxCount += groups.length - sendableGroups.length;
      for (const group of sendableGroups) {
        const outboxEntry = {
          subscriptionId: subscription.id,
          messageKind: 'reminder' as const,
          transportId: reminderConfig.transportId,
          templateKey: 'waste.email-reminder.reminder',
          sendAt: group.originalSendAt,
          dedupeKey: group.dedupeKey,
          payload: buildReminderDispatchPayload({
            config: reminderConfig,
            subscriptionId: subscription.id,
            email: subscription.email,
            locationLabel: subscription.locationLabel,
            pickupDate: group.pickupDate,
            originalSendAt: group.originalSendAt,
            members: group.members,
            unsubscribeTokenHash: subscription.unsubscribeTokenHash,
            unsubscribeTokenSecret: unsubscribeSigningSecret,
          }),
        };
        const replacesWaitingOrder = replaceable.has(group.dedupeKey) || group.members.some(
          (member) => replaceable.has(reminderMemberDedupeKey(subscription.id, group.pickupDate, member))
        );
        const result = replacesWaitingOrder
          ? await reminderRepository.enqueueOutboxEntry({
              id: randomUUID(),
              ...outboxEntry,
              sendAt: outboxEntry.sendAt < referenceTime.toISOString()
                ? referenceTime.toISOString()
                : outboxEntry.sendAt,
            })
          : await scheduleReminder(
              reminderRepository,
              outboxEntry,
              referenceTime,
              reminderConfig.materializationLookaheadDays
            );
        if (result === 'created' || result === 'inserted') createdOutboxCount += 1;
        else if (result === 'duplicate' || result === 'refreshed') duplicateOutboxCount += 1;
        else if (result === 'skipped') skippedPickupCount += group.members.length;
        validDedupeKeys.add(group.dedupeKey);
      }
    }
    const cancelledOutboxCount = await reminderRepository.cancelInvalidReminderOutboxEntries({
      validDedupeKeys: [...validDedupeKeys],
      now: referenceTime.toISOString(),
    });

    return {
      operation: 'materialize-email-reminders',
      mode: 'executed',
      activeSubscriptionCount: subscriptions.length,
      createdOutboxCount,
      duplicateOutboxCount,
      skippedPickupCount,
      cancelledOutboxCount,
    };
  }));

  return buildOperationSummary(startedAt, details);
};
