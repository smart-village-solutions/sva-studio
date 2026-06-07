export const wasteManagementPluginTranslationsENOutput = {
  output: {
    pdf: {
      title: 'PDF content',
      description: 'Define only the static PDF content here. The actual PDF export is generated in the public waste calendar web app.',
      fields: {
        brandingAssetUrl: 'Branding graphic',
        contactBlock: 'Contact and free-text block',
      },
      fieldHints: {
        brandingAssetUrl: 'This logo or graphic URL is used for the branding area in the PDF header.',
        contactBlock: 'This text is shown below the calendar as an additional contact or service note.',
      },
      actions: {
        save: 'Save PDF content',
        saving: 'Saving PDF content…',
      },
      messages: {
        loading: 'Loading PDF content.',
        loadError: 'The PDF configuration could not be loaded.',
        loadForbidden: 'Missing permission for PDF configuration.',
        saveSuccess: 'The PDF content was saved.',
        saveError: 'The PDF content could not be saved.',
        saveForbidden: 'Missing permission for PDF configuration.',
      },
      meta: {
        runtimeHint: 'The public web version generates the PDF ad hoc based on the selected address, fractions, and year.',
      },
    },
  },
} as const;
