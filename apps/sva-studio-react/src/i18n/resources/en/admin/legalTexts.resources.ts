export const legalTextsAdminENResources = {
  page: {
    title: 'Legal text management',
    subtitle:
      'Manage legal texts with UUIDs, names, versions, locales, status, and HTML content in one place.',
  },
  metrics: {
    total: 'Total versions',
    valid: 'Valid versions',
    locales: 'Locales',
    acceptances: 'Active acceptances',
  },
  filters: {
    searchLabel: 'Search',
    searchPlaceholder: 'Search by UUID, name, version, locale, or content',
    statusLabel: 'Status',
    statusAll: 'All',
    statusDraft: 'Draft only',
    statusValid: 'Valid only',
    statusArchived: 'Archived only',
  },
  actions: {
    create: 'Create legal text',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save changes',
    retry: 'Retry',
  },
  status: {
    draft: 'Draft',
    valid: 'Valid',
    archived: 'Archived',
  },
  table: {
    caption: 'Table of managed legal text versions',
    ariaLabel: 'Legal text versions',
    headerUuid: 'UUID',
    headerName: 'Name',
    headerVersion: 'Version',
    headerLocale: 'Locale',
    headerStatus: 'Status',
    headerTargets: 'Targets',
    headerContent: 'Content',
    headerPublished: 'Published',
    headerCreated: 'Created',
    headerUpdated: 'Updated',
    headerAcceptances: 'Acceptances',
    headerLastAccepted: 'Last accepted',
    headerActions: 'Actions',
    acceptanceSummary: '{{active}} active / {{total}} total',
    targetSummary: '{{roles}} roles / {{groups}} groups',
    targetsAll: 'All accounts',
    publishedUnset: 'Not set',
  },
  dialogs: {
    createTitle: 'Create legal text',
    createDescription:
      'Creates a new legal text with name, version, locale, status, and HTML content.',
    editTitle: 'Edit legal text version',
    editDescription: 'Updates content and metadata for {{id}} {{version}} ({{locale}}).',
    editDescriptionFallback: 'Updates the selected legal text version.',
  },
  detail: {
    backToList: 'Back to legal texts',
    notFound: 'The requested legal text version could not be found.',
  },
  confirm: {
    deleteTitle: 'Delete legal text version?',
    deleteDescription:
      'This legal text version will be removed permanently. Already recorded acceptances remain unchanged.',
  },
  fields: {
    name: 'Name',
    legalTextVersion: 'Version',
    locale: 'Locale',
    status: 'Status',
    publishedAt: 'Published at',
    targetRoleIds: 'Target role IDs',
    targetRoleIdsPlaceholder:
      'e.g. 11111111-1111-1111-1111-111111111111, 22222222-2222-2222-2222-222222222222',
    targetGroupIds: 'Target group IDs',
    targetGroupIdsPlaceholder:
      'e.g. aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa, bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    contentHtml: 'Content',
    contentPlaceholder: 'Edit the legal text HTML content',
  },
  editor: {
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    paragraph: 'Paragraph',
    heading: 'Heading',
    bulletList: 'Bullet list',
    clearFormatting: 'Clear formatting',
  },
  meta: {
    uuid: 'UUID: {{value}}',
    createdAt: 'Created: {{value}}',
    updatedAt: 'Updated: {{value}}',
  },
  empty: {
    title: 'No legal text versions yet',
    body: 'Create the first legal text to make content, status, and acceptances visible.',
  },
  messages: {
    error: 'Legal texts could not be loaded.',
  },
  errors: {
    forbidden: 'You do not have sufficient permissions for this legal text action.',
    csrfValidationFailed: 'Security validation failed. Please reload the page and try again.',
    rateLimited: 'Too many requests in a short time. Please wait and try again.',
    conflict: 'This legal text version already exists.',
    notFound: 'The requested legal text version could not be found.',
    databaseUnavailable: 'The IAM database is currently unavailable. Please try again later.',
    invalidRequest: 'The legal text contains invalid or incomplete data.',
  },
  validation: {
    publishedAtRequired: 'Valid legal texts require a publication date.',
    publishedAtInvalid:
      'Please enter a valid publication date in the Europe/Berlin business time zone.',
  },
} as const;
