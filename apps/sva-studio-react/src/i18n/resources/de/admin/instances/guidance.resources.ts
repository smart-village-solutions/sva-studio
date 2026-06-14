export const guidanceInstancesAdminDEResources = {
  requested: {
    title: 'Instanz gespeichert, aber noch nicht betriebsbereit',
    body: 'Die Registry-Daten sind angelegt. Als Nächstes sollten Sie den Keycloak-Status prüfen und das Provisioning ausführen.',
  },
  validated: {
    title: 'Vorprüfung abgeschlossen',
    body: 'Die Instanzdaten wurden validiert. Prüfen Sie nun Vorschau und technischen Drift, bevor Sie das Provisioning starten.',
  },
  provisioning: {
    title: 'Provisioning läuft',
    body: 'Ein Keycloak-Abgleich ist aktiv. Warten Sie auf den Laufabschluss und prüfen Sie anschließend die Aktivierung.',
  },
  active: {
    title: 'Instanz aktiv',
    body: 'Die Instanz ist betriebsbereit. Nutzen Sie die Seite weiterhin für Drift-Prüfungen, Secret-Rotation und Admin-Resets.',
  },
  failed: {
    title: 'Provisioning oder Aktivierung fehlgeschlagen',
    body: 'Prüfen Sie Protokoll, Vorbedingungen und Keycloak-Status. Beheben Sie Blocker, bevor Sie erneut starten.',
  },
  suspended: {
    title: 'Instanz suspendiert',
    body: 'Die Instanz ist absichtlich pausiert. Vor einer Reaktivierung sollten Realm- und Secret-Status erneut geprüft werden.',
  },
  archived: {
    title: 'Instanz archiviert',
    body: 'Die Instanz ist archiviert und sollte nur noch zu Dokumentations- oder Diagnosezwecken geändert werden.',
  },
  keycloakUnavailable:
    'Die Detailseite bleibt bedienbar, aber Keycloak-Aktionen und Prüfungen sind aktuell blockiert. Prüfen Sie Erreichbarkeit und Credentials.',
} as const;
