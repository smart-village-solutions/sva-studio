export const faqDEResources = {
  navigation: {
    title: 'FAQ',
  },
  editor: {
    createTitle: 'FAQ anlegen',
    editTitle: 'FAQ bearbeiten',
  },
  list: {
    title: 'FAQ',
    empty: 'Es wurden keine FAQs gefunden.',
  },
  actions: {
    create: 'FAQ anlegen',
    edit: 'Bearbeiten',
    save: 'Speichern',
  },
  fields: {
    question: 'Frage',
    answer: 'Antwort',
    languageCode: 'Sprachcode',
    sortWeight: 'Sortierung',
    visible: 'Sichtbar',
  },
  messages: {
    loading: 'FAQ werden geladen.',
    loadError: 'FAQ konnten nicht geladen werden.',
    saveError: 'FAQ konnte nicht gespeichert werden.',
  },
  pagination: {
    ariaLabel: 'FAQ-Paginierung',
    pageLabel: 'Seite {{page}}',
    previous: 'Zurück',
    next: 'Weiter',
  },
  validation: {
    required: 'Dieses Feld ist erforderlich.',
    answer: 'Bitte eine gültige Antwort ohne unerlaubtes Markup eingeben.',
    languageCode: 'Bitte einen gültigen Sprachcode eingeben.',
  },
} as const;
