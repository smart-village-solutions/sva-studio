import type { MailDispatchPayload } from '@sva/core';
import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import type { WasteEmailReminderPendingSignupInput } from '@sva/waste-management-runtime/repositories';
import {
  PublicWasteReminderSignupError,
  toIsoString,
} from './public-waste-email-reminders-signup-support.server.js';
import type {
  ReminderSignupInput,
  ReminderSignupDependencies,
} from './public-waste-email-reminders-signup-support.server.js';

const SUBSCRIPTION_LIMIT_REACHED_MESSAGE =
  'Für diese E-Mail-Adresse und diesen Standort wurde die maximale Anzahl an Erinnerungen bereits eingerichtet.';
const addHours = (value: Date, hours: number): Date =>
  new Date(value.getTime() + hours * 60 * 60 * 1000);
const buildPublicUrl = (
  baseUrl: string,
  path: string,
  params: Readonly<Record<string, string>> = {}
): string => {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};
const buildDoiDispatchPayload = (input: {
  readonly config: WasteManagementEmailReminderConfig;
  readonly subscriptionId: string;
  readonly email: string;
  readonly locationLabel: string;
  readonly confirmToken: string;
}): MailDispatchPayload => ({
  orderId: input.subscriptionId,
  transportId: input.config.transportId,
  messageKind: 'transactional',
  templateKey: 'waste.email-reminder.doi',
  locale: 'de-DE',
  addresses: [
    {
      kind: 'to',
      email: input.email,
    },
    ...(input.config.replyToEmail
      ? [
          {
            kind: 'reply_to' as const,
            email: input.config.replyToEmail,
          },
        ]
      : []),
  ],
  templatePayload: {
    confirmUrl: buildPublicUrl(input.config.publicBaseUrl, input.config.doiConfirmPath, {
      token: input.confirmToken,
    }),
    locationLabel: input.locationLabel,
    privacyPolicyUrl: input.config.privacyPolicyUrl,
    imprintUrl: input.config.imprintUrl,
    ...(input.config.serviceLabel ? { serviceLabel: input.config.serviceLabel } : {}),
    ...(input.config.dataControllerLabel
      ? { dataControllerLabel: input.config.dataControllerLabel }
      : {}),
  },
  tags: ['waste-management', 'email-reminder', 'double-opt-in'],
  metadata: {
    module: 'waste-management',
    flow: 'public-email-reminder-signup',
    subscriptionId: input.subscriptionId,
  },
});

export const buildPendingReminderSignup = (input: {
  readonly request: ReminderSignupInput;
  readonly email: string;
  readonly emailHash: string;
  readonly locationLabel: string;
  readonly now: Date;
  readonly subscriptionId: string;
  readonly confirmToken: string;
  readonly unsubscribeToken: string;
  readonly createId: () => string;
  readonly hashValue: (value: string) => string;
}): WasteEmailReminderPendingSignupInput => ({
  subscriptionId: input.subscriptionId,
  email: input.email,
  emailHash: input.emailHash,
  selection: input.request.payload.selection,
  locationLabel: input.locationLabel,
  consentVersion: input.request.reminderConfig.consentVersion,
  consentAcceptedAt: toIsoString(input.now),
  doiTokenHash: input.hashValue(input.confirmToken),
  unsubscribeTokenHash: input.hashValue(input.unsubscribeToken),
  expiresAt: toIsoString(addHours(input.now, input.request.reminderConfig.doiTokenTtlHours)),
  items: input.request.payload.items.map((item) => ({
    id: input.createId(),
    fractionId: item.fractionId,
    slotId: item.slotId,
  })),
  outbox: {
    id: input.createId(),
    transportId: input.request.reminderConfig.transportId,
    templateKey: 'waste.email-reminder.doi',
    sendAt: toIsoString(input.now),
    dedupeKey: `doi:${input.subscriptionId}`,
    payload: buildDoiDispatchPayload({
      config: input.request.reminderConfig,
      subscriptionId: input.subscriptionId,
      email: input.email,
      locationLabel: input.locationLabel,
      confirmToken: input.confirmToken,
    }),
  },
});

export const persistPendingReminderSignup = async (input: {
  readonly deps: ReminderSignupDependencies;
  readonly signup: WasteEmailReminderPendingSignupInput;
  readonly reminderConfig: WasteManagementEmailReminderConfig;
}): Promise<void> => {
  if (input.deps.persistPendingSignupWithLimitCheck) {
    const result = await input.deps.persistPendingSignupWithLimitCheck({
      signup: input.signup,
      maxSubscriptionsPerEmailAndLocation: input.reminderConfig.maxSubscriptionsPerEmailAndLocation,
    });
    if (result === 'subscription_limit_reached') {
      throw new PublicWasteReminderSignupError({
        code: 'subscription_limit_reached',
        message: SUBSCRIPTION_LIMIT_REACHED_MESSAGE,
        status: 409,
      });
    }
    return;
  }
  if (input.deps.countExistingSubscriptions) {
    const existingCount = await input.deps.countExistingSubscriptions({
      emailHash: input.signup.emailHash,
      selection: input.signup.selection,
    });
    if (existingCount >= input.reminderConfig.maxSubscriptionsPerEmailAndLocation) {
      throw new PublicWasteReminderSignupError({
        code: 'subscription_limit_reached',
        message: SUBSCRIPTION_LIMIT_REACHED_MESSAGE,
        status: 409,
      });
    }
  }
  await input.deps.persistPendingSignup(input.signup);
};
