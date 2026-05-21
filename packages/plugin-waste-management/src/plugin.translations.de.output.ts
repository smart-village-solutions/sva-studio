export const wasteManagementPluginTranslationsDEOutput = {
  output: {
    pdf: {
      title: 'PDF-Ausdruck',
      description: 'Erzeugen Sie einen Jahreskalender für genau einen Abholort und ein Jahr. Ein bestehendes PDF derselben Kombination wird still überschrieben.',
      fields: {
        collectionLocationId: 'Abholort',
        collectionLocationUnset: 'Abholort auswählen',
        year: 'Jahr',
      },
      actions: {
        generate: 'PDF erzeugen',
        generating: 'PDF wird erzeugt…',
        open: 'PDF öffnen',
      },
      messages: {
        loading: 'Ausgabeoptionen werden geladen.',
        loadError: 'Die Waste-Ausgaben konnten nicht geladen werden.',
        generateSuccess: 'Das PDF wurde erfolgreich erzeugt.',
        generateError: 'Das PDF konnte nicht erzeugt werden.',
        generateForbidden: 'Für die Waste-Ausgabe fehlt die Berechtigung.',
      },
      empty: {
        title: 'Keine Abholorte verfügbar',
        body: 'Legen Sie zuerst einen Abholort an, bevor ein PDF-Ausdruck erzeugt werden kann.',
      },
      existing: {
        title: 'Vorhandene PDFs',
        empty: 'Für diesen Abholort sind noch keine PDFs gespeichert.',
        yearLabel: 'Jahr {{value}}',
      },
      result: {
        title: 'Letztes Ergebnis',
        description: 'Der Direktlink verweist auf das aktuell gespeicherte Artefakt für die gewählte Kombination.',
      },
    },
  },
} as const;
