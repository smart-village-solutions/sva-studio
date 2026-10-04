import type { MailDispatchPayload } from '@sva/core';
import type { SqlExecutor } from '@sva/data-repositories';
import {
  createSubscriptionMethods,
  subscriptionStatements,
} from './email-reminders.subscriptions.js';
import {
  createOutboxUpsertMethods,
  outboxUpsertStatements,
} from './email-reminders.outbox-upsert.js';
import {
  createOutboxDispatchMethods,
  outboxDispatchStatements,
} from './email-reminders.outbox-dispatch.js';
import { createTokenMethods, tokenStatements } from './email-reminders.tokens.js';

export type WasteEmailReminderPendingSignupItem = Readonly<{
  id: string;
  fractionId: string;
  slotId: string;
}>;

export type WasteEmailReminderPendingSignupInput = Readonly<{
  subscriptionId: string;
  email: string;
  emailHash: string;
  selection: Readonly<{
    regionId?: string;
    cityId: string;
    streetId: string;
    houseNumberId?: string;
  }>;
  locationLabel: string;
  consentVersion: string;
  consentAcceptedAt: string;
  doiTokenHash: string;
  unsubscribeTokenHash: string;
  expiresAt: string;
  items: readonly WasteEmailReminderPendingSignupItem[];
  outbox: Readonly<{
    id: string;
    transportId: string;
    templateKey: string;
    sendAt: string;
    dedupeKey: string;
    payload: MailDispatchPayload;
  }>;
}>;

export type WasteEmailReminderActivationResult =
  | Readonly<{
      status: 'activated' | 'already_active';
      subscriptionId: string;
      locationLabel: string;
    }>
  | Readonly<{
      status: 'expired' | 'invalid';
    }>;

export type WasteEmailReminderUnsubscribeResult =
  | Readonly<{
      status: 'unsubscribed' | 'already_unsubscribed';
      subscriptionId: string;
      locationLabel: string;
    }>
  | Readonly<{
      status: 'invalid';
    }>;

export type WasteEmailReminderActiveSubscription = Readonly<{
  id: string;
  email: string;
  locationLabel: string;
  regionId?: string;
  cityId: string;
  streetId: string;
  houseNumberId?: string;
  unsubscribeTokenHash: string;
  items: readonly Readonly<{
    fractionId: string;
    slotId: string;
  }>[];
}>;

export type WasteEmailReminderUnsubscribeSubscription = Readonly<{
  subscriptionId: string;
  unsubscribeTokenHash: string;
}>;

export type WasteEmailReminderOutboxEntryInput = Readonly<{
  id: string;
  subscriptionId: string;
  messageKind: 'doi' | 'reminder';
  transportId: string;
  templateKey: string;
  sendAt: string;
  dedupeKey: string;
  payload: MailDispatchPayload;
}>;

export type WasteEmailReminderOutboxRefreshInput = Omit<WasteEmailReminderOutboxEntryInput, 'id'>;

export type WasteEmailReminderOutboxLease = Readonly<{
  id: string;
  subscriptionId: string;
  messageKind: 'doi' | 'reminder';
  transportId: string;
  templateKey: string;
  dedupeKey: string;
  attemptCount: number;
  payload: MailDispatchPayload;
}>;

export type WasteEmailReminderRepository = Readonly<{
  createPendingSignup: (input: WasteEmailReminderPendingSignupInput) => Promise<void>;
  countSubscriptionsForEmailLocation: (input: {
    readonly emailHash: string;
    readonly selection: WasteEmailReminderPendingSignupInput['selection'];
  }) => Promise<number>;
  listActiveSubscriptions: () => Promise<readonly WasteEmailReminderActiveSubscription[]>;
  enqueueOutboxEntry: (
    input: WasteEmailReminderOutboxEntryInput
  ) => Promise<'inserted' | 'refreshed' | 'duplicate'>;
  refreshPendingOutboxEntry: (input: WasteEmailReminderOutboxRefreshInput) => Promise<boolean>;
  cancelInvalidReminderOutboxEntries: (input: {
    readonly validDedupeKeys: readonly string[];
    readonly now: string;
  }) => Promise<number>;
  leaseDueOutboxEntries: (input: {
    readonly now: string;
    readonly limit: number;
  }) => Promise<readonly WasteEmailReminderOutboxLease[]>;
  claimOutboxEntryForDispatch: (input: {
    readonly outboxId: string;
    readonly leasedAt: string;
  }) => Promise<boolean>;
  markOutboxEntrySent: (input: {
    readonly outboxId: string;
    readonly now: string;
    readonly leasedAt: string;
    readonly providerMessageId?: string;
  }) => Promise<boolean>;
  markOutboxEntryFailed: (input: {
    readonly outboxId: string;
    readonly now: string;
    readonly leasedAt: string;
    readonly errorMessage: string;
    readonly retryAt?: string;
  }) => Promise<boolean>;
  loadUnsubscribeSubscriptionById: (input: {
    readonly subscriptionId: string;
  }) => Promise<WasteEmailReminderUnsubscribeSubscription | null>;
  activateByDoiTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderActivationResult>;
  unsubscribeByTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderUnsubscribeResult>;
}>;

export const createWasteEmailReminderRepository = (
  executor: SqlExecutor
): WasteEmailReminderRepository => ({
  ...createSubscriptionMethods(executor),
  ...createOutboxUpsertMethods(executor),
  ...createOutboxDispatchMethods(executor),
  ...createTokenMethods(executor),
});

export const wasteEmailReminderStatements = {
  createPendingSignupSubscription: subscriptionStatements.createPendingSignupSubscription,
  createPendingSignupItem: subscriptionStatements.createPendingSignupItem,
  createPendingSignupOutbox: subscriptionStatements.createPendingSignupOutbox,
  createOutboxEntry: outboxUpsertStatements.createOutboxEntry,
  countSubscriptionsForEmailLocation: subscriptionStatements.countSubscriptionsForEmailLocation,
  listActiveSubscriptions: subscriptionStatements.listActiveSubscriptions,
  leaseDueOutboxEntries: outboxDispatchStatements.leaseDueOutboxEntries,
  claimOutboxEntryForDispatch: outboxDispatchStatements.claimOutboxEntryForDispatch,
  markOutboxEntrySent: outboxDispatchStatements.markOutboxEntrySent,
  markOutboxEntryFailed: outboxDispatchStatements.markOutboxEntryFailed,
  cancelPendingReminderOutboxEntries: outboxDispatchStatements.cancelPendingReminderOutboxEntries,
  cancelInvalidReminderOutboxEntries: outboxDispatchStatements.cancelInvalidReminderOutboxEntries,
  selectSubscriptionByDoiTokenHash: tokenStatements.selectSubscriptionByDoiTokenHash,
  selectSubscriptionByUnsubscribeTokenHash: tokenStatements.selectSubscriptionByUnsubscribeTokenHash,
  selectSubscriptionById: tokenStatements.selectSubscriptionById,
  activateSubscription: tokenStatements.activateSubscription,
  unsubscribeSubscription: tokenStatements.unsubscribeSubscription,
} as const;
