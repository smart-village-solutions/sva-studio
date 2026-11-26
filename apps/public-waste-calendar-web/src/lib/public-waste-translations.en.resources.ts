import type { publicWasteDE } from './public-waste-translations.de.resources.js';

export const publicWasteEN = {
  calendar: {
    title: 'Waste calendar',
    loading: 'Loading waste calendar.',
  },
  pdf: {
    downloadYear: 'Download PDF for {{year}}',
    downloadingYear: 'Preparing PDF for {{year}}…',
    noYears: 'No PDF calendars are available for the current selection.',
  },
  selection: {
    back: 'Back',
    fractionsWithEmailReminder:
      'This selection controls the list, calendar export, PDF/print version and email reminders.',
    fractionsWithoutEmailReminder:
      'This selection controls the list, calendar export and PDF/print version.',
  },
  errors: {
    boundRegionUnavailable:
      'The specified region is invalid or unavailable for the public waste calendar.',
    loadFailed: 'The public waste calendar data could not be loaded.',
  },
  reminder: {
    action: 'Email reminder',
    description: 'The subscription uses these reminder times for the selected waste types:',
    sameDay: 'on collection day',
    oneDayBefore: '1 day before collection',
    daysBefore: '{{days}} days before collection',
    sendTime: 'Sent around 7 a.m. in winter and 8 a.m. in summer (German local time).',
    email: 'Email address',
    consentFallback: 'I agree to the processing of my data.',
    privacy: 'Privacy policy',
    unsupported:
      'Email reminders are unavailable for some selected waste types. Adjust your selection.',
    submit: 'Request email reminder',
    submitting: 'Requesting…',
    unavailable: 'The email reminder service is currently unavailable.',
    invalidInput: 'Enter a valid email address and accept the privacy notice.',
    requestFailed: 'The reminder could not be requested.',
  },
} satisfies typeof publicWasteDE;
