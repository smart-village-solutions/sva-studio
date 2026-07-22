import type { PluginTranslations } from '@sva/plugin-sdk';

export const pluginFaqTranslations = {
  de: {
    faq: {
      navigation: { title: 'FAQ' },
      actions: {
        create: 'FAQ anlegen',
        edit: 'FAQ bearbeiten',
        update: 'FAQ speichern',
        delete: 'FAQ löschen',
        save: 'Speichern',
      },
      permissions: {
        read: 'FAQ lesen',
        create: 'FAQ anlegen',
        update: 'FAQ bearbeiten',
        delete: 'FAQ löschen',
      },
      editor: {
        createTitle: 'FAQ anlegen',
        editTitle: 'FAQ bearbeiten',
      },
      list: {
        title: 'FAQ',
        empty: 'Keine FAQ vorhanden.',
      },
      pagination: {
        ariaLabel: 'FAQ-Paginierung',
        pageLabel: 'Seite {{page}}',
        previous: 'Zurück',
        next: 'Weiter',
      },
      fields: {
        question: 'Frage',
        actions: 'Aktionen',
        answer: 'Antwort',
        languageCode: 'Sprachcode',
        sortWeight: 'Sortiergewicht',
        visible: 'Sichtbar',
      },
      messages: {
        loading: 'FAQ wird geladen.',
        loadError: 'FAQ konnte nicht geladen werden.',
        saveError: 'FAQ konnte nicht gespeichert werden.',
        saveErrorWithReason: 'FAQ konnte nicht gespeichert werden: {{reason}}',
      },
      validation: {
        required: 'Dieses Feld ist erforderlich.',
        answer: 'Bitte eine gültige Textantwort eingeben.',
        languageCode: 'Bitte einen gültigen BCP-47-Sprachcode eingeben.',
      },
    },
  },
  en: {
    faq: {
      navigation: { title: 'FAQ' },
      actions: {
        create: 'Create FAQ',
        edit: 'Edit FAQ',
        update: 'Save FAQ',
        delete: 'Delete FAQ',
        save: 'Save',
      },
      permissions: {
        read: 'Read FAQ',
        create: 'Create FAQ',
        update: 'Edit FAQ',
        delete: 'Delete FAQ',
      },
      editor: {
        createTitle: 'Create FAQ',
        editTitle: 'Edit FAQ',
      },
      list: {
        title: 'FAQ',
        empty: 'No FAQ available.',
      },
      pagination: {
        ariaLabel: 'FAQ pagination',
        pageLabel: 'Page {{page}}',
        previous: 'Previous',
        next: 'Next',
      },
      fields: {
        question: 'Question',
        actions: 'Actions',
        answer: 'Answer',
        languageCode: 'Language code',
        sortWeight: 'Sort weight',
        visible: 'Visible',
      },
      messages: {
        loading: 'Loading FAQ.',
        loadError: 'Could not load FAQ.',
        saveError: 'Could not save FAQ.',
        saveErrorWithReason: 'Could not save FAQ: {{reason}}',
      },
      validation: {
        required: 'This field is required.',
        answer: 'Enter a valid text answer.',
        languageCode: 'Enter a valid BCP-47 language code.',
      },
    },
  },
} satisfies PluginTranslations;
