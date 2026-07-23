import type { PluginTranslations } from '@sva/plugin-sdk';

export const pluginFaqTranslations = {
  de: {
    faq: {
      navigation: { title: 'FAQ' },
      actions: {
        back: 'Zurück',
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
      tabs: { ariaLabel: 'FAQ-Bereiche', mobileLabel: 'FAQ-Bereich auswählen', basis: { label: 'Basis', title: 'Basis' }, content: { label: 'Inhalt', title: 'Inhalt' }, settings: { label: 'Einstellungen', title: 'Einstellungen' }, history: { label: 'Historie', title: 'Historie' } },
      history: { empty: 'Noch keine Historie verfügbar.', loading: 'Historie wird geladen.', tableLabel: 'FAQ-Historie', changedFields: 'Geändert: {{fields}}', emptySummary: 'Keine Detailangaben.', actions: { created: 'Angelegt', updated: 'Aktualisiert', statusChanged: 'Status geändert' }, columns: { time: 'Zeitpunkt', action: 'Aktion', actor: 'Bearbeitet von', summary: 'Zusammenfassung' }, errors: { load: 'Historie konnte nicht geladen werden.' } },
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
        publicationDate: 'Veröffentlichungszeitpunkt',
      },
      messages: {
        loading: 'FAQ wird geladen.',
        loadError: 'FAQ konnte nicht geladen werden.',
        saveError: 'FAQ konnte nicht gespeichert werden.',
        saveErrorWithReason: 'FAQ konnte nicht gespeichert werden: {{reason}}',
        deleteError: 'FAQ konnte nicht gelöscht werden.',
        deleteErrorWithReason: 'FAQ konnte nicht gelöscht werden: {{reason}}',
        validationError: 'Bitte prüfe die markierten Felder.',
      },
      validation: {
        required: 'Dieses Feld ist erforderlich.',
        answer: 'Bitte eine gültige Textantwort eingeben.',
        languageCode: 'Bitte einen gültigen BCP-47-Sprachcode eingeben.',
        sortWeight: 'Bitte ein gültiges ganzzahliges Sortiergewicht eingeben.',
      },
    },
  },
  en: {
    faq: {
      navigation: { title: 'FAQ' },
      actions: {
        back: 'Back',
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
      tabs: { ariaLabel: 'FAQ sections', mobileLabel: 'Select FAQ section', basis: { label: 'Basics', title: 'Basics' }, content: { label: 'Content', title: 'Content' }, settings: { label: 'Settings', title: 'Settings' }, history: { label: 'History', title: 'History' } },
      history: { empty: 'No history available yet.', loading: 'Loading history.', tableLabel: 'FAQ history', changedFields: 'Changed: {{fields}}', emptySummary: 'No details.', actions: { created: 'Created', updated: 'Updated', statusChanged: 'Status changed' }, columns: { time: 'Time', action: 'Action', actor: 'Actor', summary: 'Summary' }, errors: { load: 'Could not load history.' } },
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
        publicationDate: 'Publication date',
      },
      messages: {
        loading: 'Loading FAQ.',
        loadError: 'Could not load FAQ.',
        saveError: 'Could not save FAQ.',
        saveErrorWithReason: 'Could not save FAQ: {{reason}}',
        deleteError: 'Could not delete FAQ.',
        deleteErrorWithReason: 'Could not delete FAQ: {{reason}}',
        validationError: 'Please check the highlighted fields.',
      },
      validation: {
        required: 'This field is required.',
        answer: 'Enter a valid text answer.',
        languageCode: 'Enter a valid BCP-47 language code.',
        sortWeight: 'Please enter a valid integer sort weight.',
      },
    },
  },
} satisfies PluginTranslations;
