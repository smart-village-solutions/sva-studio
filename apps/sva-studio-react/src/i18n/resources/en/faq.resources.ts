export const faqENResources = {
  navigation: {
    title: 'FAQ',
  },
  editor: {
    createTitle: 'Create FAQ',
    editTitle: 'Edit FAQ',
  },
  list: {
    title: 'FAQ',
    empty: 'No FAQs were found.',
  },
  actions: {
    create: 'Create FAQ',
    edit: 'Edit',
    save: 'Save',
  },
  fields: {
    question: 'Question',
    answer: 'Answer',
    languageCode: 'Language code',
    sortWeight: 'Sort order',
    visible: 'Visible',
  },
  messages: {
    loading: 'Loading FAQs.',
    loadError: 'FAQs could not be loaded.',
    saveError: 'FAQ could not be saved.',
  },
  pagination: {
    ariaLabel: 'FAQ pagination',
    pageLabel: 'Page {{page}}',
    previous: 'Previous',
    next: 'Next',
  },
  validation: {
    required: 'This field is required.',
    answer: 'Enter a valid answer without unsupported markup.',
    languageCode: 'Enter a valid language code.',
  },
} as const;
