import { randomUUID } from 'node:crypto';
import type { PublicWasteReminderSignupResponse } from '../lib/public-waste-contract.js';
import {
  createSha256Hash,
  createOpaqueToken,
  createReminderRateLimitConsumer,
  enforceReminderSignupRateLimits,
} from './public-waste-email-reminders-signup-support.server.js';
import {
  buildPendingReminderSignup,
  persistPendingReminderSignup,
} from './public-waste-email-reminders-signup-persistence.server.js';
import type {
  ReminderSignupInput,
  ReminderSignupDependencies,
} from './public-waste-email-reminders-signup-support.server.js';

export { PublicWasteReminderSignupError } from './public-waste-email-reminders-signup-support.server.js';
export { createPublicWasteReminderPageHandler } from './public-waste-email-reminders-pages.server.js';

const DEFAULT_PENDING_HEADLINE = 'Bestätigungslink versendet';
const DEFAULT_PENDING_MESSAGE =
  'Bitte prüfen Sie Ihr E-Mail-Postfach und bestätigen Sie die Anmeldung über den enthaltenen Link.';
const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const createPublicWasteReminderSignupSubmitter =
  (deps: ReminderSignupDependencies) =>
  async (input: ReminderSignupInput): Promise<PublicWasteReminderSignupResponse> => {
    const email = normalizeEmail(input.payload.email);
    const hashValue = deps.hashValue ?? createSha256Hash;
    const emailHash = hashValue(email);
    const locationLabel = await input.repository.loadSelectionSummary({
      selection: input.payload.selection,
    });
    const now = deps.now?.() ?? new Date();
    const nowMs = now.getTime();
    const createId = deps.createId ?? randomUUID;
    const createToken = deps.createToken ?? createOpaqueToken;
    const subscriptionId = createId();
    const confirmToken = createToken();
    const unsubscribeToken = createToken();
    enforceReminderSignupRateLimits({
      consumeRateLimit: deps.consumeRateLimit,
      request: input.request,
      reminderConfig: input.reminderConfig,
      emailHash,
      now: nowMs,
    });
    const pendingSignup = buildPendingReminderSignup({
      request: input,
      email,
      emailHash,
      locationLabel,
      now,
      subscriptionId,
      confirmToken,
      unsubscribeToken,
      createId,
      hashValue,
    });
    await persistPendingReminderSignup({
      deps,
      signup: pendingSignup,
      reminderConfig: input.reminderConfig,
    });

    return {
      status: 'pending',
      headline: DEFAULT_PENDING_HEADLINE,
      message: DEFAULT_PENDING_MESSAGE,
    };
  };

export const createPublicWasteReminderSignupRateLimitConsumer = createReminderRateLimitConsumer;
