import type { WasteManagementEmailReminderConfig } from '@sva/waste-management-contracts';
import type {
  WasteEmailReminderActivationResult,
  WasteEmailReminderUnsubscribeSubscription,
  WasteEmailReminderUnsubscribeResult,
} from '@sva/waste-management-runtime/repositories';
import {
  readWasteManagementUnsubscribeTokenSubscriptionId,
  verifyWasteManagementUnsubscribeToken,
} from '@sva/waste-management-contracts/unsubscribe-token';
import {
  createSha256Hash,
  normalizeBearerTokenToHash,
  toIsoString,
} from './public-waste-email-reminders-signup-support.server.js';
import {
  createRedirectResponse,
  renderDoiSuccessPage,
  renderDoiActionError,
  renderUnsubscribeSuccessPage,
  renderUnsubscribeActionError,
  renderConfiguredReminderStatusPage,
} from './public-waste-email-reminders-page-responses.server.js';

export type ReminderTokenActionDependencies = Readonly<{
  activateByDoiTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderActivationResult>;
  loadUnsubscribeSubscriptionById: (input: {
    readonly subscriptionId: string;
  }) => Promise<WasteEmailReminderUnsubscribeSubscription | null>;
  unsubscribeByTokenHash: (input: {
    readonly tokenHash: string;
    readonly now: string;
  }) => Promise<WasteEmailReminderUnsubscribeResult>;
  now?: () => Date;
  hashValue?: (value: string) => string;
}>;

export type ReminderPageInput = Readonly<{
  request: Request;
  pathname: string;
  reminderConfig: WasteManagementEmailReminderConfig;
  unsubscribeTokenSecret: string;
}>;

const handleDoiReminderAction = async (input: {
  readonly deps: ReminderTokenActionDependencies;
  readonly page: ReminderPageInput;
  readonly token: string | undefined;
  readonly hashValue: (value: string) => string;
  readonly now: string;
}): Promise<Response> => {
  if (!input.token) {
    return renderDoiActionError(input.page, 'invalid');
  }
  const result = await input.deps.activateByDoiTokenHash({
    tokenHash: normalizeBearerTokenToHash(input.token, input.hashValue),
    now: input.now,
  });
  if (result.status === 'activated' || result.status === 'already_active') {
    return input.page.reminderConfig.activationSuccessPath
      ? createRedirectResponse(
          input.page.request,
          input.page.reminderConfig.activationSuccessPath,
          { state: result.status }
        )
      : renderDoiSuccessPage(input.page.reminderConfig);
  }
  return renderDoiActionError(input.page, result.status);
};

const handleUnsubscribeReminderAction = async (input: {
  readonly deps: ReminderTokenActionDependencies;
  readonly page: ReminderPageInput;
  readonly token: string | undefined;
  readonly now: string;
}): Promise<Response> => {
  if (!input.token) {
    return renderUnsubscribeActionError(input.page);
  }
  const subscriptionId = readWasteManagementUnsubscribeTokenSubscriptionId(input.token);
  if (!subscriptionId) {
    return renderUnsubscribeActionError(input.page);
  }
  const subscription = await input.deps.loadUnsubscribeSubscriptionById({ subscriptionId });
  if (
    !subscription ||
    !verifyWasteManagementUnsubscribeToken({
      token: input.token,
      subscriptionId,
      unsubscribeTokenHash: subscription.unsubscribeTokenHash,
      secret: input.page.unsubscribeTokenSecret,
    })
  ) {
    return renderUnsubscribeActionError(input.page);
  }
  const result = await input.deps.unsubscribeByTokenHash({
    tokenHash: subscription.unsubscribeTokenHash,
    now: input.now,
  });
  if (result.status === 'unsubscribed' || result.status === 'already_unsubscribed') {
    return input.page.reminderConfig.unsubscribeSuccessPath
      ? createRedirectResponse(
          input.page.request,
          input.page.reminderConfig.unsubscribeSuccessPath,
          { state: result.status }
        )
      : renderUnsubscribeSuccessPage(input.page.reminderConfig, result.status);
  }
  return renderUnsubscribeActionError(input.page);
};

export const createPublicWasteReminderPageHandler =
  (deps: ReminderTokenActionDependencies) =>
  async (input: ReminderPageInput): Promise<Response | null> => {
    const configuredStatusPage = renderConfiguredReminderStatusPage(input);
    if (configuredStatusPage) {
      return configuredStatusPage;
    }

    const url = new URL(input.request.url);
    const token = url.searchParams.get('token')?.trim();
    const hashValue = deps.hashValue ?? createSha256Hash;
    const now = toIsoString(deps.now?.() ?? new Date());

    if (input.pathname === input.reminderConfig.doiConfirmPath) {
      return await handleDoiReminderAction({
        deps,
        page: input,
        token,
        hashValue,
        now,
      });
    }

    if (input.pathname === input.reminderConfig.unsubscribePath) {
      return await handleUnsubscribeReminderAction({
        deps,
        page: input,
        token,
        now,
      });
    }

    return null;
  };
