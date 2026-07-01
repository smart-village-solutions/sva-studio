export const pluginSurveysStructureTranslations = {
  navigation: {
    title: 'Umfragen',
  },
  actions: {
    create: 'Umfrage anlegen',
    edit: 'Umfrage ansehen',
    update: 'Umfrage speichern',
    delete: 'Umfrage löschen',
    moderate: 'Freitexte moderieren',
    export: 'Ergebnisse exportieren',
    addTargetArea: 'Zielgebiet hinzufügen',
    removeTargetArea: 'Zielgebiet {{name}} entfernen',
    addQuestion: 'Frage hinzufügen',
    addOption: 'Option hinzufügen',
    deleteFreeText: 'Antwort {{index}} löschen',
    moveQuestionUp: 'Frage {{index}} nach oben',
    moveQuestionDown: 'Frage {{index}} nach unten',
    deleteQuestion: 'Frage {{index}} löschen',
    moveOptionUp: 'Option {{index}} nach oben',
    moveOptionDown: 'Option {{index}} nach unten',
    deleteOption: 'Option {{index}} löschen',
    closeOverlay: 'Schließen',
    confirmDelete: 'Löschen',
    cancelDelete: 'Abbrechen',
    back: 'Zurück',
  },
  pages: {
    createTitle: 'Umfrage anlegen',
    editTitle: 'Umfrage bearbeiten',
    createDescription:
      'Die Umfrage wird im normalen Content-Flow vorbereitet und nutzt bereits den stabilen Editor-Rahmen.',
    editDescription:
      'Die Umfrage ist in die normale Content-Struktur eingebunden und nutzt denselben Editor-Rahmen wie im Create-Fall.',
  },
  tabs: {
    ariaLabel: 'Umfrage-Bereiche',
    basis: {
      label: 'Basis',
      title: 'Basis',
      description: 'Administrativer Rahmen der Umfrage.',
    },
    content: {
      label: 'Inhalt',
      title: 'Inhalt',
      description: 'Redaktioneller Survey-Inhalt und Fragen.',
    },
    moderation: {
      label: 'Moderation',
      title: 'Moderation',
      description: 'Freitext-Freigaben und Moderation.',
    },
    results: {
      label: 'Ergebnisse',
      title: 'Ergebnisse',
      description: 'Überblick, Auswertung und Export.',
    },
    history: {
      label: 'Historie',
      title: 'Historie',
      description: 'Änderungsverlauf der Umfrage.',
    },
  },
  cards: {
    basis: {
      title: 'Basis',
      description: 'Status, Laufzeit, Zielgebiet und Metadaten der Umfrage.',
      identity: {
        title: 'Identität',
        description: 'Titel und Status der Umfrage.',
      },
      schedule: {
        title: 'Laufzeit',
        description: 'Start- und Endzeitraum der Umfrage.',
      },
      targetArea: {
        title: 'Zielgebiet',
        description: 'Optionale Zielgebiete für die Umfrage.',
      },
      metadata: {
        title: 'Metadaten',
        description: 'Zeitliche Metadaten der Umfrage.',
      },
    },
    content: {
      title: 'Inhalts-Rahmen',
      description: 'Beschreibung, Hinweise und Frageneditor der Umfrage.',
      descriptions: {
        title: 'Beschreibung',
        description: 'Kurz- und Langbeschreibung der Umfrage.',
      },
      participation: {
        title: 'Teilnahme und Sichtbarkeit',
        description: 'Teilnahmeoptionen und Sichtbarkeit der Ergebnisse.',
      },
      notices: {
        title: 'Hinweise',
        description: 'Datenschutz- und Transparenzhinweise.',
      },
      questions: {
        title: 'Fragen',
        description: 'Fragen und Antwortoptionen der Umfrage.',
      },
    },
    moderation: {
      title: 'Moderations-Rahmen',
      description: 'Freitext-Freigaben werden nach dem ersten Speichern verfügbar.',
    },
    results: {
      title: 'Ergebnis-Rahmen',
      description: 'Ergebnisse und Exporte der Umfrage.',
      summary: {
        title: 'Übersicht',
        description: 'Kompakter Überblick über die laufende Umfrage.',
      },
      questions: {
        title: 'Frageergebnisse',
        description: 'Aggregierte Ergebnisse pro Frage.',
      },
      export: {
        title: 'Export',
        description: 'Interne Exporte der Survey-Ergebnisse.',
      },
    },
    history: {
      title: 'Historien-Rahmen',
      description: 'Historieneinträge werden nach dem ersten Speichern verfügbar.',
    },
  },
} as const;
