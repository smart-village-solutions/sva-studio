export const pluginSurveysTranslations = {
  de: {
    surveys: {
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
          title: 'Basis-Rahmen',
          description: 'Status, Laufzeit, Zielgebiet und Metadaten folgen in den nächsten Schritten.',
        },
        content: {
          title: 'Inhalts-Rahmen',
          description: 'Beschreibung, Hinweise und Frageneditor folgen in den nächsten Schritten.',
        },
        moderation: {
          title: 'Moderations-Rahmen',
          description: 'Freitext-Freigaben werden nach dem ersten Speichern verfügbar.',
        },
        results: {
          title: 'Ergebnis-Rahmen',
          description: 'Ergebnisse und Exporte werden nach dem ersten Speichern verfügbar.',
        },
        history: {
          title: 'Historien-Rahmen',
          description: 'Historieneinträge werden nach dem ersten Speichern verfügbar.',
        },
      },
      messages: {
        createPendingHint:
          'Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.',
        sectionPlaceholder:
          'Die fachlichen Felder dieses Bereichs folgen in den nächsten Umsetzungsabschnitten.',
        historyPlaceholder: 'Die Historie erscheint hier, sobald die Umfrage bereits angelegt wurde.',
      },
      permissions: {
        read: 'Umfragen lesen',
        create: 'Umfragen anlegen',
        update: 'Umfragen bearbeiten',
        delete: 'Umfragen löschen',
        moderate: 'Freitexte moderieren',
        export: 'Ergebnisse exportieren',
      },
    },
  },
  en: {
    surveys: {
      navigation: {
        title: 'Surveys',
      },
      actions: {
        create: 'Create survey',
        edit: 'View survey',
        update: 'Save survey',
        delete: 'Delete survey',
        moderate: 'Moderate free text',
        export: 'Export results',
      },
      pages: {
        createTitle: 'Create survey',
        editTitle: 'Edit survey',
        createDescription:
          'The survey is prepared in the standard content flow and already uses the stable editor frame.',
        editDescription:
          'The survey is already part of the standard content flow and uses the same editor frame as the create flow.',
      },
      tabs: {
        ariaLabel: 'Survey sections',
        basis: {
          label: 'Basics',
          title: 'Basics',
          description: 'Administrative survey frame.',
        },
        content: {
          label: 'Content',
          title: 'Content',
          description: 'Editorial survey content and questions.',
        },
        moderation: {
          label: 'Moderation',
          title: 'Moderation',
          description: 'Free-text approvals and moderation.',
        },
        results: {
          label: 'Results',
          title: 'Results',
          description: 'Overview, evaluation, and export.',
        },
        history: {
          label: 'History',
          title: 'History',
          description: 'Survey change history.',
        },
      },
      cards: {
        basis: {
          title: 'Basics frame',
          description: 'Status, schedule, target area, and metadata follow in the next steps.',
        },
        content: {
          title: 'Content frame',
          description: 'Description, notices, and the question editor follow in the next steps.',
        },
        moderation: {
          title: 'Moderation frame',
          description: 'Free-text approvals become available after the first save.',
        },
        results: {
          title: 'Results frame',
          description: 'Results and exports become available after the first save.',
        },
        history: {
          title: 'History frame',
          description: 'History entries become available after the first save.',
        },
      },
      messages: {
        createPendingHint:
          'This section is already visible, but it will only be populated with data after the first save.',
        sectionPlaceholder:
          'The dedicated fields for this section follow in the next implementation steps.',
        historyPlaceholder: 'The history will appear here once the survey has been created.',
      },
      permissions: {
        read: 'Read surveys',
        create: 'Create surveys',
        update: 'Update surveys',
        delete: 'Delete surveys',
        moderate: 'Moderate free text',
        export: 'Export results',
      },
    },
  },
} as const;
