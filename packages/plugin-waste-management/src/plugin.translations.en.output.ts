export const wasteManagementPluginTranslationsENOutput = {
  output: {
    pdf: {
      title: 'PDF printout',
      description: 'Generate a yearly calendar for exactly one collection location and one year. An existing PDF for the same combination is silently overwritten.',
      fields: {
        collectionLocationId: 'Collection location',
        collectionLocationUnset: 'Select collection location',
        year: 'Year',
      },
      actions: {
        generate: 'Generate PDF',
        generating: 'Generating PDF…',
        open: 'Open PDF',
      },
      messages: {
        loading: 'Loading output options.',
        loadError: 'Waste outputs could not be loaded.',
        generateSuccess: 'The PDF was generated successfully.',
        generateError: 'The PDF could not be generated.',
        generateForbidden: 'Missing permission for waste output.',
      },
      empty: {
        title: 'No collection locations available',
        body: 'Create a collection location first before generating a PDF printout.',
      },
      existing: {
        title: 'Existing PDFs',
        empty: 'No PDFs are stored for this collection location yet.',
        yearLabel: 'Year {{value}}',
      },
      result: {
        title: 'Latest result',
        description: 'The direct link points to the currently stored artifact for the selected combination.',
      },
    },
  },
} as const;
