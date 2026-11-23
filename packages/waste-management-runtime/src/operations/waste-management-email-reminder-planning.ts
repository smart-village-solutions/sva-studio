import type { WasteCollectionLocationRecord, WasteFractionRecord } from '@sva/waste-management-contracts';

import { z } from 'zod';

import type { WasteEmailReminderPlanningOrder } from '../repositories/email-reminders.js';
import { buildReminderHintText } from './waste-management-email-reminder-hints.js';

export const createUtcIsoAtHour = (date: Date, hourUtc: number): string =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourUtc, 0, 0, 0)
  ).toISOString();

export const parseIsoDateUtc = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid_iso_date:${value}`);
  }
  return parsed;
};

export const addDaysUtc = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const matchSelectionLocations = (
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
    if (
      subscription.houseNumberId &&
      location.houseNumberId !== undefined &&
      location.houseNumberId !== subscription.houseNumberId
    ) {
      return false;
    }
    if (!subscription.houseNumberId && location.houseNumberId !== undefined) {
      return false;
    }
    return true;
  });

export type ReminderMember = Readonly<{
  fraction: Pick<WasteFractionRecord, 'id' | 'name'>;
  slotId: string;
  hints?: readonly string[];
}>;

type ReminderGroupIdentity = Readonly<{
  subscriptionId: string;
  pickupDate: string;
  originalSendAt: string;
}>;

type ReminderGroup = ReminderGroupIdentity &
  Readonly<{
    dedupeKey: string;
    members: readonly ReminderMember[];
  }>;

export const reminderMemberDedupeKey = (
  subscriptionId: string,
  pickupDate: string,
  member: ReminderMember
): string => `reminder:${subscriptionId}:${member.fraction.id}:${member.slotId}:${pickupDate}`;

export const groupReminderMembers = (
  planned: readonly (ReminderGroupIdentity & ReminderMember)[]
): readonly ReminderGroup[] => {
  const groups = new Map<
    string,
    ReminderGroupIdentity & { dedupeKey: string; members: ReminderMember[] }
  >();
  for (const { subscriptionId, pickupDate, originalSendAt, fraction, slotId, hints } of planned) {
    const dedupeKey = `reminder-group:${subscriptionId}:${pickupDate}:${originalSendAt}`;
    const group = groups.get(dedupeKey) ?? {
      dedupeKey,
      subscriptionId,
      pickupDate,
      originalSendAt,
      members: [],
    };
    group.members.push({ fraction, slotId, hints });
    groups.set(dedupeKey, group);
  }
  return Array.from(groups.values());
};

const retainsReminderDelivery = (order: WasteEmailReminderPlanningOrder): boolean =>
  (order.attemptCount > 0 && !order.retryAt) ||
  order.status === 'processing' ||
  order.status === 'sent' ||
  order.status === 'failed';

export const selectUnreservedReminderGroups = (
  groups: readonly ReminderGroup[],
  existing: readonly WasteEmailReminderPlanningOrder[]
): readonly ReminderGroup[] => {
  const ordersThatRetainDelivery = existing.filter(retainsReminderDelivery);
  const retainedGroups = new Set(ordersThatRetainDelivery.map((order) => order.dedupeKey));
  const retainedMembers = new Set(
    ordersThatRetainDelivery.flatMap((order) => order.memberKeys ?? [order.dedupeKey])
  );
  return groups.flatMap((group) => {
    if (retainedGroups.has(group.dedupeKey)) return [];
    const members = group.members.filter(
      (member) =>
        !retainedMembers.has(
          reminderMemberDedupeKey(group.subscriptionId, group.pickupDate, member)
        )
    );
    return members.length > 0 ? [{ ...group, members }] : [];
  });
};

export const reminderAppointmentsSchema = z
  .array(
    z.object({
      fractionName: z.string().trim().min(1),
      hintText: z.string().optional(),
    })
  )
  .nonempty();

export const buildGroupReminderContent = (members: readonly ReminderMember[]) => {
  const byFraction = new Map<string, { fractionName: string; hints: string[] }>();
  for (const member of members) {
    const current = byFraction.get(member.fraction.id) ?? {
      fractionName: member.fraction.name,
      hints: [],
    };
    current.hints.push(...(member.hints ?? []));
    byFraction.set(member.fraction.id, current);
  }
  const appointments = reminderAppointmentsSchema.parse(
    Array.from(byFraction.entries())
      .sort(
        ([leftId, left], [rightId, right]) =>
          left.fractionName.localeCompare(right.fractionName, 'de') || leftId.localeCompare(rightId)
      )
      .map(([, value]) => ({
        fractionName: value.fractionName,
        hintText: buildReminderHintText(value.hints),
      }))
  );
  return {
    fractionName: appointments.map(({ fractionName }) => fractionName).join(', '),
    reminderAppointments: JSON.stringify(appointments),
  };
};
