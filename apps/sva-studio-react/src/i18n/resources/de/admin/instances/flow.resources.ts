export const flowInstancesAdminDEResources = {
  realmModeTitle: 'Realm-Modus',
  realmModeSubtitle:
    'Legen Sie fest, ob ein neuer Realm angelegt oder ein bestehender Realm abgeglichen wird.',
  realmModeNewLabel: 'Neuer Realm',
  realmModeExistingLabel: 'Bestehender Realm',
  realmModeNew:
    'Neuer Realm: Der Provisioning-Lauf legt den Realm an und blockiert, wenn er bereits existiert.',
  realmModeExisting:
    'Bestehender Realm: Der Provisioning-Lauf erwartet den Realm bereits in Keycloak und zeigt Drift an.',
  createHint:
    'Das Speichern legt nur die Instanz und den Registry-Sollzustand an. Keycloak-Provisioning wird erst im Detail explizit ausgeführt.',
  preflightTitle: 'Vorbedingungen',
  preflightSubtitle:
    'Prüft Root-Host-Zugriff, technischen Keycloak-Zugang und die notwendigen Stammdaten.',
  preflightEmpty: 'Für diese Instanz wurden noch keine Vorbedingungen geladen.',
  previewTitle: 'Vorschau',
  previewSubtitle: 'Zeigt die geplanten Create-/Update-Schritte vor dem eigentlichen Provisioning.',
  previewEmpty: 'Für diese Instanz wurde noch keine Provisioning-Vorschau erzeugt.',
  executeTitle: 'Ausführen',
  executeSubtitle:
    'Startet das eigentliche Tenant-Provisioning explizit und schreibt ein sichtbares Operationsprotokoll.',
  protocolTitle: 'Protokoll',
  protocolSubtitle:
    'Persistierte Keycloak-Provisioning-Läufe mit Schrittstatus, Ergebnis und Request-ID.',
  protocolEmpty: 'Für diese Instanz wurden noch keine Keycloak-Provisioning-Läufe aufgezeichnet.',
} as const;
