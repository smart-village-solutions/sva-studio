export const wasteManagementPluginTranslationsENPage = {
  page: {
    title: 'Waste calendar',
    description:
      'Manage master data, tours, schedule deviations and technical tools for waste management.',
    webVersionLead: 'The data is also published here:',
    webVersionLinkLabel: 'Waste calendar web version',
    syncStatus: {
      loadingTitle: 'Loading synchronization status',
      loadingText: 'Checking the current data revision.',
      errorTitle: 'Synchronization status unavailable',
      errorText: 'The current data revision could not be determined. Please reload the page.',
      cleanTitle: 'Data is synchronized',
      cleanText:
        'There are currently no Studio changes waiting to be transferred to the SVA mainserver.',
      cleanWithDate:
        'There are currently no pending Studio changes. Last successful synchronization: {{date}}.',
      pendingTitle: 'Synchronization required',
      pendingText:
        'Saved changes to collection dates or locations still need to be transferred to the SVA mainserver.',
      finishChangesFirst:
        'If possible, finish and save all planned changes first. Changes made during or after the transfer require another synchronization.',
      lastSuccess: 'Last successful synchronization: {{date}}.',
      unknownTitle: 'Synchronization status unknown',
      unknownText:
        'The data revision could not be compared safely with the last synchronization. You can start synchronization manually.',
      failedTitle: 'Last synchronization failed',
      permissionRequired: 'An authorized person must start the synchronization.',
      startAction: 'Synchronize changes',
      startingAction: 'Starting synchronization …',
      runningTitle: 'Synchronization in progress',
      runningPreparing: 'The changes are being calculated. Exact counts will appear next.',
      runningCreateCountOne: '{{count}} date will be transferred.',
      runningCreateCountOther: '{{count}} dates will be transferred.',
      runningDeleteCountOne: '{{count}} outdated date will be removed.',
      runningDeleteCountOther: '{{count}} outdated dates will be removed.',
      runningDuration: 'The transfer can take up to one hour.',
      openJob: 'View operation',
    },
  },
} as const;
