export const rulesAccountENResources = {
  title: 'Account rules',
  navLabel: 'Account rules',
  subtitle:
    'Review tenant-wide deletion rules and the handling of your own content in a dedicated view.',
  summary: {
    deactivateAfterDays: 'Deactivate after',
    deactivateAfterDaysHint: 'Time until account deactivation in days.',
    pseudonymizeAfterDays: 'Pseudonymize after',
    pseudonymizeAfterDaysHint: 'Time until pseudonymization in days.',
    deleteAfterDays: 'Delete after',
    deleteAfterDaysHint: 'Time until final deletion in days.',
    defaultContentStrategy: 'Default content rule',
  },
  sections: {
    global: {
      title: 'Tenant-wide rules',
      deactivateAfterDays:
        'After the configured period the account is deactivated first and blocked for direct sign-ins.',
      pseudonymizeAfterDays:
        'After the second period personal data is pseudonymized unless retention duties still apply.',
      deleteAfterDays:
        'After the final period the account is permanently removed unless a legal hold is active.',
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
