export const rulesAccountENResources = {
  title: 'Account rules',
  navLabel: 'Account rules',
  subtitle:
    'Review tenant-wide deletion rules and the handling of your own content in a dedicated view.',
  summary: {
    deactivateAfterDays: 'Deactivate after',
    deactivateAfterDaysHint: 'Days since the last successful login until account deactivation.',
    pseudonymizeAfterDays: 'Pseudonymize after',
    pseudonymizeAfterDaysHint: 'Days since the last successful login until pseudonymization.',
    deleteAfterDays: 'Tombstone soft delete after',
    deleteAfterDaysHint:
      'Days since the last successful login until the final tombstone soft delete.',
    defaultContentStrategy: 'Default content rule',
  },
  sections: {
    global: {
      title: 'Tenant-wide rules',
      deactivateAfterDays:
        'After the configured number of days since the last successful login, the account is deactivated and blocked for direct sign-ins.',
      pseudonymizeAfterDays:
        'After the configured number of days since the last successful login, personal data is pseudonymized unless retention duties still apply.',
      deleteAfterDays:
        'After the configured number of days since the last successful login, the account enters the final tombstone soft-delete state; it is not physically removed.',
      defaultContentStrategy:
        'The default content rule defines whether personal content is kept or follows the owner lifecycle.',
    },
    personal: {
      title: 'Personal content rule',
    },
  },
  fields: {
    contentPreference: 'Rule for own content',
    contentPreferenceHint:
      'Choose whether your own content stays retained or follows the account lifecycle.',
  },
  actions: {
    save: 'Save content rule',
    saving: 'Saving content rule ...',
  },
  messages: {
    loading: 'Loading account rules ...',
    saveSuccess: 'The content rule was saved.',
  },
  strategies: {
    retain: 'Keep content',
    with_owner_lifecycle: 'Handle content with the account lifecycle',
  },
} as const;
