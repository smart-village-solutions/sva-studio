export const wasteManagementTourMergeTranslationsEN = {
  merge: {
    open: 'Merge selected tours',
    tooMany: 'Select no more than {{count}} tours to merge.',
    intro:
      'Choose the tour that will stay published. It takes over the collection points of the other tours. The other tours are archived.',
    close: 'Close dialog',
    choose: 'Choose the target tour',
    chooseHelp:
      'For tours with the same name, use the collection point count, recurrence and tour ID to tell them apart.',
    pointCountOne: '{{count}} collection point',
    pointCount: '{{count}} collection points',
    pointCountUnknown: 'Collection point count unavailable',
    optionDetails: '{{points}} · {{recurrence}} · {{validity}} · ID {{id}}',
    tourLabel: '{{name}} · {{points}} · ID {{id}}',
    validityRange: '{{start}}–{{end}}',
    validityFrom: 'from {{start}}',
    validityUntil: 'through {{end}}',
    validityUnknown: 'Validity unspecified',
    hiddenOne: 'One selected tour is outside the filter',
    hidden: 'Some selected tours are outside the filter',
    hiddenSelected: '{{tour}} remains selected.',
    hiddenTarget:
      '{{tour}} remains selected. In this preview it stays published as the target tour.',
    hiddenSource: '{{tour}} remains selected. In this preview it is archived as a source tour.',
    hiddenSuffix: ' · outside the filter',
    previewLoading: 'Loading preview …',
    impact: 'After merging',
    keepsPublishing: 'Stays published',
    total: '{{existing}} existing + {{added}} new = {{total}} collection points.',
    sharedNamed: '{{location}} is counted once.',
    sharedOne: 'The shared collection point is counted once.',
    shared: '{{count}} shared collection points are each counted once.',
    archives: 'Will be archived',
    archiveEffectOne:
      'The source tour remains visible in the archive with its schedule and assignments. It will no longer supply calendar dates of its own.',
    archiveEffect:
      'The source tours remain visible in the archive with their schedules and assignments. They will no longer supply calendar dates of their own.',
    planningEffect: 'Collection dates, waste fractions and notes are preserved.',
    cancel: 'Cancel',
    confirm: 'Merge tours',
    saving: 'Merging tours …',
    rejected: 'Merge rejected',
    reviewSelection: 'Change selection',
    refresh: 'Refresh preview',
    conflicts: {
      status: '{{tour}} is not published. Select published tours.',
      recurrence:
        '{{tour}} has the recurrence “{{turnus}}”. The target tour uses “{{targetTurnus}}”. Select tours with identical recurring schedules.',
      fractions:
        '{{tour}} has different waste fractions. Select tours with identical waste fractions.',
      validity:
        '{{tour}} has a different validity period. Select tours with identical validity periods.',
      notes: '{{tour}} has different notes. Select tours with identical notes.',
      shifts:
        '{{tour}} has different one-off or rescheduled dates. Select tours with identical schedules.',
      assignments:
        '{{tour}} has tour runs or collection-point-specific pickup dates that prevent merging.',
      duplicateLinks:
        '{{tour}} has duplicate collection point assignments. Select another target tour or clean up the assignments.',
    },
    issues: {
      stale: {
        title: 'Preview is out of date',
        detail:
          'The data used for this preview has changed or is unavailable. Load a new preview and review its effects. This attempt has not merged any tours.',
      },
      'rolled-back': {
        title: 'Merge failed',
        detail:
          'Studio stopped the merge. No collection points were reassigned and no tours were archived. Reload the preview to try again.',
      },
      unknown: {
        title: 'Result could not be confirmed',
        detail: 'Refresh the preview and check the current data before trying again.',
      },
      load: {
        title: 'Preview could not be loaded',
        detail: 'Reload the preview to review the effects.',
      },
      missing: {
        title: 'Selected tour is missing',
        detail:
          'At least one selected tour is no longer available. Check the tour list and change your selection.',
      },
      forbidden: {
        title: 'Permission required',
        detail: 'You need permission to manage tours in order to merge them.',
      },
    },
    success: '“{{target}}” now has {{locations}} collection points. Archived tours: {{archived}}.',
    refreshListError:
      'The tour list could not be refreshed. Reload the page to see the current state.',
  },
};
