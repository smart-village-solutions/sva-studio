import type { WasteManagementEmailReminderConfig } from '@sva/plugin-sdk';

export const fixedWasteEmailReminderPaths = {
  doiConfirmPath: '/email-reminders/confirm',
  unsubscribePath: '/email-reminders/unsubscribe',
  signupSuccessPath: '/email-reminders/pending',
  activationSuccessPath: '/email-reminders/active',
  unsubscribeSuccessPath: '/email-reminders/unsubscribed',
  invalidTokenPath: '/email-reminders/token-invalid',
} as const satisfies Pick<
  WasteManagementEmailReminderConfig,
  | 'doiConfirmPath'
  | 'unsubscribePath'
  | 'signupSuccessPath'
  | 'activationSuccessPath'
  | 'unsubscribeSuccessPath'
  | 'invalidTokenPath'
>;

export const withFixedWasteEmailReminderPaths = (
  config: WasteManagementEmailReminderConfig
): WasteManagementEmailReminderConfig => ({
  ...config,
  ...fixedWasteEmailReminderPaths,
});
