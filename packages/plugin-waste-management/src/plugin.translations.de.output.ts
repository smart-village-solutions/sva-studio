export const wasteManagementPluginTranslationsDEOutput = {
  output: {
    pdf: {
      title: 'PDF-Inhalte',
      description: 'Definieren Sie hier nur die statischen Inhalte des PDF-Exports. Die eigentliche PDF-Erzeugung erfolgt in der öffentlichen Webversion des Abfallkalenders.',
      fields: {
        brandingAssetUrl: 'Branding-Grafik',
        contactBlock: 'Kontakt- und Freitextblock',
      },
      fieldHints: {
        brandingAssetUrl: 'Oben rechts im PDF wird diese Grafik oder Logo-URL für das Branding verwendet.',
        contactBlock: 'Dieser Text erscheint unterhalb des Kalenders als zusätzlicher Kontakt- oder Servicehinweis.',
      },
      actions: {
        save: 'PDF-Inhalte speichern',
        saving: 'PDF-Inhalte werden gespeichert…',
      },
      messages: {
        loading: 'PDF-Inhalte werden geladen.',
        loadError: 'Die PDF-Konfiguration konnte nicht geladen werden.',
        loadForbidden: 'Für die PDF-Konfiguration fehlt die Berechtigung.',
        saveSuccess: 'Die PDF-Inhalte wurden gespeichert.',
        saveError: 'Die PDF-Inhalte konnten nicht gespeichert werden.',
        saveForbidden: 'Für die PDF-Konfiguration fehlt die Berechtigung.',
      },
      meta: {
        runtimeHint: 'Die öffentliche Webversion erzeugt das PDF ad hoc auf Basis der gewählten Adresse, Fraktionen und des Jahres.',
      },
    },
  },
} as const;
