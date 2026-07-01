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
          'Die Umfrage wird im normalen Content-Flow vorbereitet und später in den Fach-Tabs weiter ausgebaut.',
        editDescription:
          'Die Umfrage ist in die normale Content-Struktur eingebunden und wird in den nächsten Abschnitten fachlich ausgebaut.',
        placeholderTitle: 'Survey-Editor folgt in den nächsten Abschnitten',
        placeholderBody:
          'Host-Route, Rechte und Integration in die Inhaltsliste sind bereits angeschlossen. Die fachlichen Tabs und Formulare folgen im nächsten Umsetzungsschritt.',
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
          'The survey is prepared in the standard content flow and will be expanded with dedicated tabs next.',
        editDescription:
          'The survey already uses the standard content flow and will receive its dedicated tabs and forms next.',
        placeholderTitle: 'Survey editor follows in the next sections',
        placeholderBody:
          'The host route, permissions, and content list integration are already wired. The dedicated survey tabs and forms follow in the next implementation step.',
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
