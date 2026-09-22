export const invitationInstancesAdminENResources = {
  title: 'Account invitation',
  open: 'Customize account invitation',
  dialogTitle: 'Customize account invitation',
  description:
    'Keycloak continues to create the secure password link and send the email. Only the instance-specific copy is edited here.',
  status: 'Realm projection: {{status}}',
  projection: {
    default: 'SVA default',
    in_sync: 'confirmed',
    drifted: 'different',
    unavailable: 'unavailable',
  },
  tokens:
    'Allowed placeholders: {{tenantName}}, {{passwordSetupLink}}, {{tenantHomepageLink}}, {{linkExpiresIn}}. The password link must occur exactly once in the message.',
  subject: 'Subject',
  body: 'Message',
  passwordLinkLabel: 'Password link label',
  homepageLinkLabel: 'Homepage link label',
  preview: 'Preview with sample data',
  previewExpiry: '30 minutes',
  save: 'Save template',
  reset: 'Reset to SVA default',
  resetConfirm: 'Remove the custom template and reset it to the SVA default?',
  saved: 'The template was saved. The projection status has been refreshed.',
  saveFailed: 'The template could not be saved or projected.',
  invalid: 'The template is invalid.',
} as const;
