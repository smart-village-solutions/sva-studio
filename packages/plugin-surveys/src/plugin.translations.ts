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
        addTargetArea: 'Zielgebiet hinzufügen',
        removeTargetArea: 'Zielgebiet {{name}} entfernen',
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
        unlimitedScheduleHint: 'Ohne Enddatum bleibt die Umfrage unbefristet.',
        targetAreasEmpty: 'Es stehen derzeit keine Zielgebiete zur Auswahl.',
        metadataCreateHint: 'Metadaten erscheinen nach dem ersten Speichern der Umfrage.',
      },
      validation: {
        titleRequired: 'Bitte einen Titel angeben.',
      },
      fields: {
        title: 'Titel',
        status: 'Status',
        startAt: 'Start',
        endAt: 'Ende',
        targetAreas: 'Zielgebiete',
        targetAreasSearch: 'Zielgebiet suchen',
        targetAreasSearchPlaceholder: 'Zielgebiet auswählen',
        createdAt: 'Erstellt',
        updatedAt: 'Aktualisiert',
        publishedAt: 'Veröffentlicht',
        archivedAt: 'Archiviert',
        statusOptions: {
          draft: 'Entwurf',
          active: 'Aktiv',
          archived: 'Archiviert',
        },
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
        addTargetArea: 'Add target area',
        removeTargetArea: 'Remove target area {{name}}',
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
          title: 'Basics',
          description: 'Status, schedule, target area, and survey metadata.',
          identity: {
            title: 'Identity',
            description: 'Survey title and status.',
          },
          schedule: {
            title: 'Schedule',
            description: 'Survey start and end window.',
          },
          targetArea: {
            title: 'Target area',
            description: 'Optional target areas for the survey.',
          },
          metadata: {
            title: 'Metadata',
            description: 'Temporal survey metadata.',
          },
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
        unlimitedScheduleHint: 'Without an end date, the survey remains open-ended.',
        targetAreasEmpty: 'There are currently no target areas available.',
        metadataCreateHint: 'Metadata appears after the survey has been saved for the first time.',
      },
      validation: {
        titleRequired: 'Please provide a title.',
      },
      fields: {
        title: 'Title',
        status: 'Status',
        startAt: 'Start',
        endAt: 'End',
        targetAreas: 'Target areas',
        targetAreasSearch: 'Search target area',
        targetAreasSearchPlaceholder: 'Select target area',
        createdAt: 'Created',
        updatedAt: 'Updated',
        publishedAt: 'Published',
        archivedAt: 'Archived',
        statusOptions: {
          draft: 'Draft',
          active: 'Active',
          archived: 'Archived',
        },
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
