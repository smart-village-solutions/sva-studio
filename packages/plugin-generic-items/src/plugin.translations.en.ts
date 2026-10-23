import { genericItemsTranslationsDe } from './plugin.translations.de.js';

// Existing copy continues to use the German fallback; new media labels are translated.
export const genericItemsTranslationsEn = {
  ...genericItemsTranslationsDe,
  genericItems: {
    ...genericItemsTranslationsDe.genericItems,
    create: {
      heading: 'Generic content',
      optional: 'Optional',
      navigation: 'Jump to a content section',
      technical: 'Additional technical details (optional)',
      technicalPresent: 'Details entered',
      technicalEmpty: 'No additional details',
    },
    fields: { ...genericItemsTranslationsDe.genericItems.fields, imageTags: 'Filter by tag' },
    actions: {
      ...genericItemsTranslationsDe.genericItems.actions,
      openSavedContent: 'Open saved content',
    },
    messages: {
      ...genericItemsTranslationsDe.genericItems.messages,
      createdNavigationError: 'The content was created, but the editing view could not be opened.',
      unsavedAfterCreate:
        'The content was created. Newer changes in this form have not been saved.',
      mediaPickerLoading: 'Loading media.',
      mediaPickerLoadError: 'Media could not be loaded.',
    },
  },
};
