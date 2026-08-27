export const wasteManagementPluginTranslationsDEPage = {
  page: {
    title: 'Abfallkalender',
    description:
      'Verwalten Sie Stammdaten, Touren, Ausweichtermine und technische Werkzeuge des Abfall-Management-Moduls.',
    webVersionLead: 'Die Daten werden u.a. hier dargestellt:',
    webVersionLinkLabel: 'Abfallkalender-Webversion',
    syncStatus: {
      loadingTitle: 'Abgleichsstatus wird geladen',
      loadingText: 'Der Datenstand wird geprüft.',
      errorTitle: 'Abgleichsstatus nicht verfügbar',
      errorText:
        'Der aktuelle Datenstand konnte nicht ermittelt werden. Bitte laden Sie die Seite erneut.',
      cleanTitle: 'Daten sind synchronisiert',
      cleanText:
        'Aktuell stehen keine Studio-Änderungen zur Übertragung an den SVA Mainserver aus.',
      cleanWithDate:
        'Aktuell stehen keine Studio-Änderungen aus. Letzter erfolgreicher Abgleich: {{date}}.',
      pendingTitle: 'Abgleich steht aus',
      pendingText:
        'Gespeicherte Änderungen an Terminen oder Abholorten müssen noch an den SVA Mainserver übertragen werden.',
      finishChangesFirst:
        'Schließen und speichern Sie nach Möglichkeit zuerst alle geplanten Änderungen. Änderungen während oder nach der Übertragung erfordern einen weiteren Abgleich.',
      lastSuccess: 'Letzter erfolgreicher Abgleich: {{date}}.',
      unknownTitle: 'Abgleichsstatus unklar',
      unknownText:
        'Der Datenstand konnte nicht sicher mit dem letzten Abgleich verglichen werden. Sie können die Synchronisierung manuell starten.',
      failedTitle: 'Letzter Abgleich fehlgeschlagen',
      permissionRequired: 'Eine berechtigte Person muss die Synchronisierung starten.',
      startAction: 'Änderungen synchronisieren',
      startingAction: 'Synchronisierung wird gestartet …',
      runningTitle: 'Synchronisierung läuft',
      runningPreparing:
        'Die Änderungen werden ermittelt. Die genaue Anzahl erscheint anschließend.',
      runningCreateCountOne: '{{count}} Termin wird übertragen.',
      runningCreateCountOther: '{{count}} Termine werden übertragen.',
      runningDeleteCountOne: '{{count}} veralteter Termin wird entfernt.',
      runningDeleteCountOther: '{{count}} veraltete Termine werden entfernt.',
      runningDuration: 'Die Übertragung kann bis zu einer Stunde dauern.',
      openJob: 'Vorgang anzeigen',
    },
  },
} as const;
