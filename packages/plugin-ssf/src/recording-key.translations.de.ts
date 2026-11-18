export const recordingKeyTranslationsDe = {
  keys: {
    confirmedStatus: 'Bestätigten Auftrag prüfen',
    retryConfirmed: 'Ergebnis erneut abrufen',
    policyNotice:
      'Zusätzlich zur Richtlinie benötigt jede neue Aufzeichnung einen aktiven Organisationsschlüssel und einen persönlichen Schlüssel der aufzeichnenden Person.',
    replaceNotice:
      'Ein Ersatz gilt für neue Aufzeichnungen. Bewahren Sie jeden früheren privaten Schlüssel für die damit geschützten Aufzeichnungen auf. Ein Ersatz stellt Aufzeichnungen mit verlorenem Schlüssel nicht wieder her.',
    history: 'Öffentliche Schlüsselversionen',
    version: 'Schlüsselversion',
    noActive:
      'Es ist kein Organisationsschlüssel aktiv. Aufzeichnungen sind erst nach Aktivierung eines gesicherten Schlüssels möglich.',
    create: 'Organisationsschlüssel erzeugen',
    replace: 'Ersatz vorbereiten',
    reload: 'Neu laden',
    custody: 'Privaten Organisationsschlüssel sichern',
    custodyNotice:
      'Die Datei enthält einen unverschlüsselten privaten Schlüssel. Verwahren Sie sie im Passwortmanager oder Tresor Ihrer Organisation. Wer die Datei und die Transferberechtigung besitzt, kann Zugänge zu den damit geschützten Aufzeichnungen wiederherstellen.',
    printNotice:
      'Unverschlüsselter privater Organisationsschlüssel. Verwahren Sie dieses Blatt im Tresor. Der vollständige Text ist Base64url-kodiertes UTF-8-JSON. Dekodieren Sie ihn für den Import in eine JSON-Datei.',
    download: 'Schlüsseldatei herunterladen',
    print: 'Vollständigen Schlüssel drucken',
    saved: 'Ich habe den vollständigen privaten Schlüssel sicher verwahrt.',
    activate: 'Gesicherten Schlüssel aktivieren',
    activated: 'Die Aktivierung wurde bestätigt. Die Liste zeigt den aktuellen Gateway-Stand.',
    cancel: 'Abbrechen',
    login: 'Anmelden',
    states: { active: 'Aktiv', prepared: 'Vorbereitet', superseded: 'Ersetzt' },
    errors: {
      AUTHENTICATION_REQUIRED: 'Ihre Sitzung ist beendet. Melden Sie sich an, um fortzufahren.',
      PERMISSION_REQUIRED: 'Ihnen fehlt die Berechtigung für diesen Vorgang.',
      PREPARATION_NOT_FOUND: 'Die Auswahl ist nicht mehr verfügbar. Laden Sie sie neu.',
      KEY_VERSION_CHANGED:
        'Die Schlüsselversion hat sich geändert. Prüfen Sie die aktuelle Version und beginnen Sie erneut.',
      SCOPE_CHANGED:
        'Die Auswahl oder die Schlüssel haben sich geändert. Laden und bestätigen Sie die Auswahl erneut.',
      PREPARATION_USED:
        'Diese Vorbereitung wurde bereits verwendet. Beginnen Sie eine neue Vorbereitung.',
      PREPARATION_EXPIRED: 'Die Vorbereitung ist abgelaufen. Beginnen Sie erneut.',
      INVALID_KEY:
        'Die Schlüsseldatei oder die signierten Schlüsseldaten passen nicht zum Vorgang.',
      INVALID_PROOF:
        'Der Besitznachweis ist fehlgeschlagen. Prüfen Sie die Version und beginnen Sie erneut.',
      TRANSFER_SCOPE_TOO_LARGE: 'Wählen Sie weniger Aufzeichnungen aus.',
      RECORDING_PROTOCOL_UPGRADE_REQUIRED:
        'Dieser Mandant verwendet noch das frühere Aufzeichnungsprotokoll. Bitten Sie den Betrieb, die Umstellung auf die neue Version zu prüfen und freizugeben.',
      RECORDING_UNAVAILABLE:
        'Der Aufzeichnungsdienst ist nicht erreichbar. Bei ungewissem Übermittlungsergebnis wiederholen Sie denselben bestätigten Vorgang.',
    },
  },
  transfer: {
    description:
      'Erteilen Sie Zugänge zu ausgewählten Aufzeichnungen mit dem privaten Organisationsschlüssel. Unterschiedliche Schlüsselversionen benötigen jeweils eine eigene Bestätigung. Bestehende Zugänge bleiben erhalten.',
    selection: 'Ausgewählte Aufzeichnungen und Schlüssel',
    sourceHint: 'Name auswählen oder bekannte frühere Benutzerkennung eingeben',
    source: 'Bisherige Person',
    target: 'Zielperson',
    reason: 'Begründung der Zugangsvergabe',
    choose: 'Person auswählen',
    find: 'Aufzeichnungen suchen',
    more: 'Weitere Aufzeichnungen laden',
    keyCount: 'Inhaltsschlüssel',
    preview: 'Diese Gruppe vorbereiten',
    confirmTitle: 'Zugangsübertragung bestätigen',
    targetKey: 'Version und Fingerabdruck des Zielschlüssels',
    file: 'Private Organisationsschlüsseldatei',
    confirm: 'Ich bestätige diese Zielperson, Schlüsselversion, Begründung und genaue Auswahl.',
    commit: 'Zugang erteilen',
    receipt: 'Zugang erteilt. Beleg',
  },
} as const;
