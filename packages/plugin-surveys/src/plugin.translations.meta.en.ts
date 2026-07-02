export const pluginSurveysMetaEnTranslations = {
  labels: {
    questionSection: 'Question {{index}}',
    optionSection: 'Option {{index}}',
    freeTextVisibility: 'Answer {{index}} publicly visible',
    exportWithoutFreeText: 'Export without free text',
    exportWithFreeText: 'Export with free text',
    exportFormats: {
      csv: 'CSV',
      json: 'JSON',
      excel: 'Excel',
      xml: 'XML',
    },
  },
  permissions: {
    read: 'Read surveys',
    create: 'Create surveys',
    update: 'Edit surveys',
    delete: 'Delete surveys',
    moderate: 'Moderate free text',
    export: 'Export results',
  },
  history: {
    createHint: 'History becomes available after the first save.',
    loading: 'Loading history.',
    empty: 'No history available yet.',
    emptySummary: 'No additional summary available.',
    tableLabel: 'Survey history',
    columns: {
      time: 'Time',
      action: 'Action',
      actor: 'Actor',
      summary: 'Summary',
    },
    errors: {
      forbidden: 'History must not be displayed.',
      notFound: 'No history was found for this survey.',
      load: 'The history could not be loaded.',
    },
    changedFields: 'Changed fields: {{fields}}',
    actions: {
      created: 'Created',
      updated: 'Updated',
      statusChanged: 'Status changed',
    },
  },
} as const;
