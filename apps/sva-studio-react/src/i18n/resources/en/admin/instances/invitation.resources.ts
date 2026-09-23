export const invitationInstancesAdminENResources = {
  title: 'Account invitation',
  open: 'Customize account invitation',
  dialogTitle: 'Customize account invitation',
  description:
    'Keycloak continues to create the secure password link and send the email. Only the instance-specific copy is edited here.',
  serverDescription:
    'This template applies to every instance without custom copy. Keycloak still creates the secure password link and sends the email.',
  source: 'Template in use: {{source}}',
  sources: {
    instance: 'Instance template',
    server: 'Server template',
    sva_default: 'SVA default',
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
  resetInstance: 'Use server template',
  resetInstanceConfirm: 'Remove the instance template and use the server template from now on?',
  resetServer: 'Use SVA default',
  resetServerConfirm: 'Remove the server template and use the SVA default from now on?',
  saved: 'The template was saved.',
  saveConflict:
    'The template changed in the meantime. The current version was loaded; review it and save again.',
  saveFailed: 'The template could not be saved.',
  invalid: 'The template is invalid.',
  pageTitle: 'Templates',
  pageDescription: 'Manage text templates for this Studio installation.',
  loading: 'Loading template.',
  loadFailed: 'The template could not be loaded.',
  sampleTenantName: 'Example tenant',
  sampleHomepageUrl: 'https://example.invalid/',
} as const;
