import { genericItemsTranslationsDe } from './plugin.translations.de.js';

// Existing copy continues to use the German fallback; new media labels are translated.
export const genericItemsTranslationsEn = {
  ...genericItemsTranslationsDe,
  genericItems: {
    ...genericItemsTranslationsDe.genericItems,
    fields: { ...genericItemsTranslationsDe.genericItems.fields, imageTags: 'Filter by tag' },
    messages: {
      ...genericItemsTranslationsDe.genericItems.messages,
      mediaPickerLoading: 'Loading media.',
      mediaPickerLoadError: 'Media could not be loaded.',
    },
  },
};
