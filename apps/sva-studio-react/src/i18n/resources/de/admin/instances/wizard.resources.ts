export const wizardInstancesAdminDEResources = {
  steps: {
    basics: {
      title: 'Basisdaten',
      description: 'Instanz-ID, Anzeigename und Parent-Domain für den Registry-Eintrag festlegen.',
    },
    auth: {
      title: 'Keycloak-Zuordnung',
      description:
        'Realm, Client und optionales Issuer-/Secret-Mapping für den Tenant hinterlegen.',
    },
    tenantAdmin: {
      title: 'Tenant-Admin',
      description: 'Optional den initialen Tenant-Admin für Bootstrap und Recovery vorbereiten.',
    },
    review: {
      title: 'Prüfen & Erstellen',
      description: 'Eingaben kontrollieren und die Instanz zunächst nur in der Registry anlegen.',
    },
  },
  validation: {
    instanceId: 'Bitte eine Instanz-ID angeben.',
    displayName: 'Bitte einen Anzeigenamen angeben.',
    parentDomain: 'Bitte eine Parent-Domain angeben.',
    authRealm: 'Bitte ein Auth-Realm angeben.',
    authRealmFormat: 'Bitte ein gültiges Auth-Realm ohne Leerzeichen oder Fließtext angeben.',
    authClientId: 'Bitte eine Auth-Client-ID angeben.',
    authClientSecret: 'Bitte ein Tenant-Client-Secret angeben.',
    tenantAdminClientId: 'Bitte eine Tenant-Admin-Client-ID angeben.',
    tenantAdminClientSecret: 'Bitte ein Tenant-Admin-Client-Secret angeben.',
    wasteProjectUrl:
      'Bitte eine Supabase-Projekt-URL angeben, sobald Abfallmanagement für die Instanz aktiviert wird.',
  },
  readiness: {
    secretTitle: 'Tenant-Client-Secret',
    secretReady:
      'Ein Secret wird mit der Instanz gespeichert und kann im Provisioning direkt geprüft werden.',
    secretMissing:
      'Noch kein Secret eingetragen. Der spätere Abgleich bleibt dadurch unvollständig.',
    secretGenerated:
      'Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
    tenantAdminTitle: 'Initialer Tenant-Admin',
    tenantAdminReady:
      'Ein Tenant-Admin ist hinterlegt und kann beim ersten Bootstrap oder Reset verwendet werden.',
    tenantAdminMissing:
      'Kein Tenant-Admin hinterlegt. Der Schritt bleibt nach dem Erstellen manuell offen.',
    followUpTitle: 'Nächster Betriebs-Schritt',
    followUpSummary:
      'Nach dem Speichern folgt im Detail die technische Prüfung und das Keycloak-Provisioning.',
  },
  authHint:
    'Das Tenant-Client-Secret ist für bestehende Realms stark empfohlen, damit Status- und Drift-Prüfungen vollständig laufen.',
  authSecretGeneratedHint:
    'Für neue Realms müssen Sie hier kein Secret kennen. Studio erzeugt es beim Provisioning und speichert es anschließend.',
  tenantAdminOptional:
    'Diese Angaben sind optional, solange der Tenant-Admin nicht direkt beim ersten Provisioning neu gesetzt werden muss.',
  reviewTitle: 'Eingaben prüfen',
  reviewSubtitle:
    'Die Instanz wird jetzt nur angelegt. Der eigentliche Keycloak-Abgleich folgt danach im separaten Setup.',
  reviewDefaultIssuer: 'Wird automatisch aus dem Realm abgeleitet',
  reviewNotConfigured: 'Nicht konfiguriert',
  actions: {
    back: 'Zurück',
    next: 'Weiter',
  },
} as const;
