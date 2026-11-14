export const emailVerificationInstancesAdminENResources = {
  serverTitle: 'Email verification',
  serverDescription:
    'This standard applies to instances without an override. Saving synchronizes inheriting instances only; custom templates are retained. No email is sent.',
  resetServerConfirm: 'Reset the general verification template to the neutral built-in standard?',
  resetInstance: 'Use general template',

  reauthRequired: 'Sign in again, then reopen the template. Your draft is retained until then.',
  currentTexts: 'Messages saved in the meantime',
  title: 'Email verification',
  open: 'Edit email verification',
  description:
    'These German texts apply to registration and email address changes. Saving takes immediate effect in this municipality’s Keycloak realm. No email is sent.',
  realm: 'Target realm: {{realm}}',
  tokens:
    'Allowed placeholders: {{tenantName}}, {{verificationLink}}, {{linkExpiresIn}}. The verification link must occur exactly once in the message body.',
  previewLink: '[Verify email address]',
  htmlWarning:
    'The existing HTML differs from the generated layout. Saving regenerates it from the message body.',
  existingHtml: 'View existing HTML',
  replaceHtml: 'Explicitly replace existing HTML',
  loadFailed: 'Could not load the effective verification messages. Close and reopen to retry.',
  invalid:
    'Check the template: exactly one verification link, no unknown placeholders, HTML or free URLs.',
  saved: 'The template was saved in Keycloak and read back successfully.',
  conflict:
    'The messages changed in the meantime. Your draft is preserved. The current messages are shown for comparison. Review them before saving again.',
  saveFailed:
    'Saving was not confirmed. Keycloak may already have received the change. Your draft is preserved; close, reopen and check the current messages.',
  reset: 'Use SVA default',
  resetConfirm: 'Remove this instance override and use the current general verification template?',
} as const;
