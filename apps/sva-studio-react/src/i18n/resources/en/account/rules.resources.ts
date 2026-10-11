export const rulesAccountENResources = {
  title: 'Account rules',
  navLabel: 'Account rules',
  subtitle:
    'See what happens to your account and content after a long period without signing in. The deadlines apply only after your first successful sign-in.',
  summary: {
    deactivateAfterDays: 'Deactivate account after',
    deactivateAfterDaysHint: 'Days without a successful sign-in before the account is blocked.',
    pseudonymizeAfterDays: 'Remove personal details after',
    pseudonymizeAfterDaysHint:
      'Days without a successful sign-in before personal details are removed.',
    deleteAfterDays: 'Mark account as deleted after',
    deleteAfterDaysHint:
      'Days without a successful sign-in before the account is marked as deleted.',
    defaultContentStrategy: 'What happens to your content',
  },
  sections: {
    global: {
      title: 'Rules for personal accounts in this instance',
      deactivateAfterDays:
        'After the specified time without signing in, the account is deactivated. Direct sign-in is no longer possible.',
      pseudonymizeAfterDays:
        'Later, personal details are removed from the account unless they must be retained.',
      deleteAfterDays:
        'After that, the account is marked as deleted. The record is not completely removed.',
      defaultContentStrategy:
        'The content rule determines whether your content is kept or handled together with your account.',
    },
    personal: {
      title: 'Personal content rule',
    },
  },
  fields: {
    contentPreference: 'Rule for own content',
    contentPreferenceHint:
      'Choose whether your content is kept or handled together with your account.',
  },
  actions: {
    save: 'Save content rule',
    saving: 'Saving…',
    saved: 'Saved',
  },
  messages: {
    loading: 'Loading account rules ...',
    saveSuccess: 'The content rule was saved.',
  },
  strategies: {
    retain: 'Keep content',
    with_owner_lifecycle: 'Handle content together with the account',
  },
} as const;
