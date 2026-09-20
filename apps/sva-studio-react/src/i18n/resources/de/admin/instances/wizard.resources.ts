export const wizardInstancesAdminDEResources = {
  steps: {
    basics: {
      title: 'Instanz',
      description: 'Instanz-ID, Anzeigename und Parent-Domain für den Registry-Eintrag festlegen.',
    },
    auth: {
      title: 'Nutzer-Datenbank (Keycloak-Realm)',
      description:
        'Realm, Client und optionales Issuer-/Secret-Mapping für den Tenant hinterlegen.',
    },
    tenantAdmin: {
      title: 'Erster Administrator',
      description: 'Den initialen Administrator vollständig für Bootstrap und Recovery erfassen.',
    },
    review: {
      title: 'Prüfen und anlegen',
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
    tenantAdminUsername: 'Bitte einen Benutzernamen für den ersten Administrator angeben.',
    tenantAdminEmail: 'Bitte eine E-Mail-Adresse für den ersten Administrator angeben.',
    tenantAdminEmailFormat: 'Bitte eine gültige E-Mail-Adresse angeben.',
    tenantAdminFirstName: 'Bitte den Vornamen des ersten Administrators angeben.',
    tenantAdminLastName: 'Bitte den Nachnamen des ersten Administrators angeben.',
    wasteProjectUrl:
      'Bitte eine Supabase-Projekt-URL angeben, sobald Abfallmanagement für die Instanz aktiviert wird.',
  },
  readiness: {
    serverChecking: 'Die serverseitige Bereitschaft wird geprüft.',
    serverUnavailable:
      'Die serverseitige Bereitschaft konnte nicht bestätigt werden. Die Instanz kann noch nicht angelegt werden.',
    createGroup: 'Vor der Anlage zu beheben',
    provisioningGroup: 'Wird von Studio eingerichtet',
    activationGroup: 'Vor der Aktivierung noch erforderlich',
    noBlockers: 'Keine offenen Befunde in dieser Gruppe.',
    recheck: 'Erneut prüfen',
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
  realmCatalog: {
    placeholder: 'Nutzer-Datenbank auswählen',
    search: 'Nutzer-Datenbanken durchsuchen',
    empty: 'Keine Nutzer-Datenbank gefunden.',
    system_realm: 'System-Realm kann nicht ausgewählt werden.',
    already_assigned: 'Bereits einer anderen Studio-Instanz zugeordnet.',
  },
  realmSuitability: {
    ready: 'Die Nutzer-Datenbank ist bereit.',
    auto_completable: 'Studio kann die fehlenden eigenen Artefakte ergänzen.',
    manual_resolution_required: 'Vor der Anlage ist eine manuelle Klärung erforderlich.',
  },
  capabilities: {
    worker: 'Provisioning-Worker',
    queue: 'Auftragswarteschlange',
    callback: 'Status-Rückmeldung',
    provisioner: 'Provisioner',
    ingress: 'Ingress und TLS',
    plugin: 'Plugin-Lifecycle',
  },
  studioInstanceLabel: 'Studio-Instanz',
  studioInstanceSva: 'Smart Village App',
  studioInstanceKassel: 'KasselDIALOG',
  technicalDetails: 'Technische Details',
  existingRealmTechnicalDetails:
    'Studio verwendet den Login-Client {{loginClient}} und den Administrations-Client {{adminClient}}. Issuer und Secrets werden in der zuständigen sicheren Einrichtung geprüft oder erfasst.',
  authHint:
    'Das Tenant-Client-Secret ist für bestehende Realms stark empfohlen, damit Status- und Drift-Prüfungen vollständig laufen.',
  authSecretGeneratedHint:
    'Für neue Realms müssen Sie hier kein Secret kennen. Studio erzeugt es beim Provisioning und speichert es anschließend.',
  newRealmBaselineSummary:
    'Studio leitet Realm und Clients automatisch ab und richtet Theme, Dark Mode, ausschließlich Deutsch, Events, Benutzerprofil, instanceId-Mapper und die E-Mail-Grundkonfiguration serverseitig ein. Danach muss nur das SMTP-Passwort direkt in Keycloak gesetzt werden.',
  tenantAdminOptional: 'Alle Angaben sind für das initiale Administratorprofil erforderlich.',
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
