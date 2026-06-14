export const helpInstancesAdminDEResources = {
  sections: {
    what: 'Was ist das?',
    value: 'Was eintragen?',
    source: 'Quelle',
    impact: 'Auswirkung',
  },
  realmMode: {
    title: 'Realm-Modus',
    what: 'Legt fest, ob Studio einen Realm neu anlegen oder einen bereits existierenden Realm prüfen und abgleichen soll.',
    value: 'Im Regelfall für produktionsnahe Tenants "Bestehender Realm" wählen.',
    source: 'Kommt aus dem Betriebsfall des Tenants und aus dem aktuellen Stand in Keycloak.',
    impact:
      'Der falsche Modus führt dazu, dass Provisioning blockiert oder einen unerwarteten Drift meldet.',
    defaultHint: 'Für bestehende Tenants ist "Bestehender Realm" der Standard.',
  },
  instanceId: {
    title: 'Instanz-ID',
    what: 'Technische Kennung der Instanz innerhalb von Studio und der Registry.',
    value: 'Ein stabiler, kleingeschriebener Bezeichner wie "hb-meinquartier".',
    source:
      'Kommt aus dem Tenant-Namensschema und wird oft auch in Mappern, Hostnamen und Rollen wiederverwendet.',
    impact:
      'Änderungen oder Tippfehler ziehen sich durch Hostnamen, Mapper und Betriebsautomatisierung.',
  },
  displayName: {
    title: 'Anzeigename',
    what: 'Lesbarer Name der Instanz für Administration und UI.',
    value: 'Den fachlichen Tenant-Namen eintragen, z. B. "MeinQuartier".',
    source: 'Kommt aus dem Produkt- oder Mandantennamen.',
    impact:
      'Ein falscher Wert ist meist kein technischer Blocker, erzeugt aber Verwirrung in Verwaltung und Support.',
  },
  parentDomain: {
    title: 'Parent-Domain',
    what: 'Die übergeordnete Domain, unter der der primäre Hostname der Instanz erzeugt wird.',
    value: 'Die gemeinsame Plattform-Domain, z. B. "studio.smart-village.app".',
    source: 'Kommt aus der Zielumgebung oder dem Plattform-Setup.',
    impact:
      'Eine falsche Domain erzeugt falsche Hostnamen und inkonsistente Redirect- und Runtime-Konfiguration.',
    defaultHint: 'Wenn möglich wird die aktuelle Host-Domain als Vorschlag vorbelegt.',
  },
  authRealm: {
    title: 'Auth-Realm',
    what: 'Name des Tenant-Realm in Keycloak, aus dem sich Issuer und Prüfungen ableiten.',
    value: 'Den exakten Realm-Namen eintragen, z. B. "saas-hb-meinquartier".',
    source: 'Kommt direkt aus Keycloak.',
    impact:
      'Ein falscher Realm verhindert Statusprüfungen, Drift-Erkennung und Provisioning gegen den richtigen Tenant.',
  },
  authClientId: {
    title: 'Auth-Client-ID',
    what: 'OIDC-Client im Tenant-Realm, den Studio zur Anmeldung und zum Abgleich erwartet.',
    value:
      'In der Regel "sva-studio-login", sofern kein abweichender Tenant-Client verwendet wird.',
    source: 'Kommt aus dem Keycloak-Client im Tenant-Realm.',
    impact:
      'Ein falscher Client führt zu fehlgeschlagenen Statusprüfungen und unpassenden Client-Änderungen.',
    defaultHint: 'Standardwert ist "sva-studio-login".',
  },
  authIssuerUrl: {
    title: 'Auth-Issuer-URL',
    what: 'Explizite Issuer-URL des Tenant-Realm. Wenn sie leer bleibt, wird sie aus dem Realm-Namen abgeleitet.',
    value: 'Meist leer lassen oder die vollständige Realm-URL eintragen.',
    source:
      'Kommt aus der Keycloak-Installation oder wird automatisch aus Basis-URL und Realm gebildet.',
    impact:
      'Ein falscher Issuer führt zu fehlerhaften Token-Prüfungen und inkonsistenter Runtime-Konfiguration.',
    defaultHint: 'Leer bedeutet: Issuer automatisch aus Basis-URL und Realm berechnen.',
  },
  authClientSecret: {
    title: 'Tenant-Client-Secret',
    what: 'Secret des Tenant-Clients, das Studio verschlüsselt speichert und für technische Abgleiche nutzt.',
    value:
      'Bei bestehenden Realms das aktuelle Secret des konfigurierten Tenant-Clients eintragen. Bei neuen Realms leer lassen.',
    source:
      'Bei bestehenden Realms kommt es aus den Client-Credentials in Keycloak. Bei neuen Realms wird es erst beim Provisioning erzeugt.',
    impact:
      'Bei bestehenden Realms blockiert ein fehlendes Secret Secret-Checks und Teile des Provisioning-/Drift-Abgleichs. Bei neuen Realms wird es nach dem Provisioning automatisch gespeichert.',
  },
  tenantAdminClientId: {
    title: 'Tenant-Admin-Client-ID',
    what: 'OIDC-Client für tenant-spezifische Verwaltungs- und Bootstrap-Vorgänge.',
    value: 'Den erwarteten Client-Namen eintragen, z. B. "sva-studio-realm-admin".',
    source:
      'Kommt aus dem Tenant-Realm in Keycloak oder aus dem vorgesehenen Provisioning-Vertrag.',
    impact:
      'Ohne korrekte Client-ID bleiben tenant-spezifische Verwaltungsaktionen und Teile der Benutzerverwaltung blockiert.',
    defaultHint:
      'Falls der Client noch nicht existiert, kann Studio ihn über das Provisioning bereitstellen.',
  },
  tenantAdminClientSecret: {
    title: 'Tenant-Admin-Client-Secret',
    what: 'Secret des Tenant-Admin-Clients, das Studio verschlüsselt speichert und für Verwaltungsoperationen nutzt.',
    value: 'Bei bestehenden Realms das aktuelle Secret des Tenant-Admin-Clients eintragen.',
    source: 'Kommt aus den Client-Credentials des Tenant-Admin-Clients in Keycloak.',
    impact:
      'Ein fehlendes oder falsches Secret blockiert Verwaltungsoperationen, Rollenpflege und den Abgleich des Tenant-Admin-Clients.',
  },
  tenantAdminUsername: {
    title: 'Admin-Benutzername',
    what: 'Technischer Benutzername des Tenant-Admins für Bootstrap oder Reset.',
    value: 'Den geplanten oder bestehenden Login-Namen des Tenant-Admins eintragen.',
    source: 'Kommt aus dem Tenant-Betrieb oder aus dem bestehenden Keycloak-Setup.',
    impact:
      'Ohne diesen Wert kann der Admin im Provisioning nicht neu gesetzt oder sauber geprüft werden.',
  },
  tenantAdminEmail: {
    title: 'Admin-E-Mail',
    what: 'Kontakt- und Login-E-Mail des initialen Tenant-Admins.',
    value: 'Die fachlich gewünschte E-Mail-Adresse des Tenant-Admins eintragen.',
    source: 'Kommt aus dem Tenant- oder Betriebsauftrag.',
    impact: 'Eine falsche E-Mail erschwert Benachrichtigung, Login und spätere Recovery.',
  },
  tenantAdminFirstName: {
    title: 'Admin-Vorname',
    what: 'Vorname des initialen Tenant-Admins.',
    value: 'Den gewünschten oder bestehenden Vornamen eintragen.',
    source: 'Kommt aus dem Benutzerprofil des Tenant-Admins.',
    impact: 'Ist primär ein Komfort- und Qualitätsmerkmal, sollte aber konsistent gepflegt werden.',
  },
  tenantAdminLastName: {
    title: 'Admin-Nachname',
    what: 'Nachname des initialen Tenant-Admins.',
    value: 'Den gewünschten oder bestehenden Nachnamen eintragen.',
    source: 'Kommt aus dem Benutzerprofil des Tenant-Admins.',
    impact: 'Ist primär ein Komfort- und Qualitätsmerkmal, sollte aber konsistent gepflegt werden.',
  },
} as const;
