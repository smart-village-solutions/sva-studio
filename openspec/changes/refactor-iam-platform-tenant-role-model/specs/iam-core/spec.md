## ADDED Requirements
### Requirement: Root- und Tenant-Rollenmodell sind realm-separiert
Das System SHALL Root-/Plattform-Rollen und tenantlokale Rollen strikt nach Realm trennen. Plattformrollen gelten ausschließlich im Root-Realm; tenantlokale Rollen gelten ausschließlich im Tenant-Realm.

#### Scenario: Root-Request bleibt tenant-los
- **WHEN** ein authentifizierter Benutzer auf dem Root-Host einen IAM- oder Instanzverwaltungs-Request ausführt
- **THEN** bleibt `instanceId` im Session- und Handler-Kontext leer
- **AND** der Root-Scope wird nicht als Pseudo-Tenant modelliert
- **AND** tenantlokale Rollen oder Gruppen werden für diesen Request nicht aufgelöst

#### Scenario: Tenant-Request kennt keine Plattformrollen
- **WHEN** ein authentifizierter Benutzer in einem Tenant-Realm einen tenantseitigen IAM-Request ausführt
- **THEN** berücksichtigt das System ausschließlich tenantlokale Rollen, Gruppen und Permissions der aktiven `instanceId`
- **AND** Plattformrollen aus dem Root-Realm haben in diesem Kontext keine Wirkung

### Requirement: Root-Realm verwendet nur instance_registry_admin als relevante Plattformrolle
Das System SHALL im Root-Realm `instance_registry_admin` als einzige relevante Rolle für Root-Control-Plane- und Instanzverwaltungszugriffe behandeln.

#### Scenario: Plattform-User wird mit Root-Rolle projiziert
- **WHEN** ein Root-User über den Plattformpfad gelesen oder in das Session-Profil projiziert wird
- **THEN** enthält die Rollenprojektion höchstens die Rolle `instance_registry_admin`
- **AND** andere tenantbezogene Rollen werden nicht in den Plattformvertrag injiziert

#### Scenario: Root-Control-Plane prüft nur instance_registry_admin
- **WHEN** ein Root-Host-Request eine Instanzverwaltungs-, Provisioning- oder Root-Control-Plane-Mutation ausführt
- **THEN** prüft das System ausschließlich auf die Plattformrolle `instance_registry_admin`
- **AND** es verlangt dafür keine tenantlokalen Rollen oder Permissions

### Requirement: Tenant-Realm verwendet system_admin als geschützte Vollzugriffsrolle
Das System SHALL im Tenant-Realm `system_admin` als geschützte, defaultfähige Vollzugriffsrolle für die initiale Instanzadministration beibehalten. `system_admin` MUST direkt die vollständige tenantlokale Permission-Menge bündeln und darf funktional nicht von zusätzlichen Gruppen, Rollenbündeln oder Übergangs-Standardrollen abhängen.

#### Scenario: Initialer Tenant-Admin erhält system_admin
- **WHEN** eine neue Instanz erfolgreich angelegt und ihr initialer Tenant-Admin gebootstrappt wird
- **THEN** weist das System diesem Benutzer die Rolle `system_admin` im Tenant-Realm zu
- **AND** diese Rolle enthält die vollständige tenantlokale Verwaltungs- und Fachrechtebasis

#### Scenario: system_admin wirkt ohne zusätzliche Admin-Gruppe vollständig
- **WHEN** ein Tenant-Benutzer ausschließlich die Rolle `system_admin` besitzt
- **THEN** erhält er dieselbe vollständige tenantlokale Permission-Basis, die für den geschützten Vollzugriff vorgesehen ist
- **AND** das System verlangt dafür keine zusätzliche Gruppenmitgliedschaft wie `admins`
- **AND** das System verlangt dafür keine ergänzende Standardrolle wie `core_admin`

#### Scenario: Tenant-Admin-Projektion enthält keine Root-Rolle
- **WHEN** der initiale Tenant-Admin oder ein anderer Tenant-User im Tenant-Realm gelesen wird
- **THEN** enthält seine Rollenprojektion keine Plattformrolle `instance_registry_admin`
- **AND** die Root-/Tenant-Rollenmodelle bleiben getrennt

### Requirement: Frühere Standardrollen sind nur noch Altbestands- und Migrationsartefakte
Das System SHALL frühere tenantlokale Standardrollen wie `app_manager`, `feature-manager`, `interface-manager`, `designer`, `editor` oder `moderator` nicht mehr als automatisch verwaltete Default- oder Systemrollen materialisieren. Historische Altbestände dürfen nur noch von Cleanup-, Repair- oder Upgrade-Pfaden erkannt und bereinigt werden.

#### Scenario: Reseed oder Reconcile erzeugt keine Legacy-Standardrollen neu
- **WHEN** ein Seed-, Repair- oder Reconcile-Pfad tenantlokale Rollen gegen das aktuelle Sollmodell abgleicht
- **THEN** materialisiert er `system_admin` als einzige geschützte tenantlokale Defaultrolle
- **AND** er erzeugt keine frühere Standardrolle wie `app_manager` oder `editor` neu als Default- oder Systemrolle

#### Scenario: Historische Legacy-Rollen bleiben nur Migrationsinput
- **WHEN** eine Bestandsinstanz noch frühere tenantlokale Standardrollen enthält
- **THEN** dürfen Cleanup- oder Upgrade-Pfade diese Rollen als historischen Altbestand markieren, neutralisieren oder manuell ersetzbar machen
- **AND** das System behandelt sie nicht mehr als normative Quelle tenantlokaler Verwaltungs- oder Modulrechte

## MODIFIED Requirements
### Requirement: IAM Account Management Scope Resolution
IAM Account Management SHALL resolve each authenticated IAM-v1 request as either `platform` or `instance` scope before reading or mutating users, roles, permissions, or sync state. The platform scope MUST be backed by the Root-Realm with `instance_registry_admin` as the only relevant platform role. The instance scope MUST be backed by the Tenant-Realm with tenantlokale Rollen und Permissions.

#### Scenario: Root-host user list uses platform scope
- **WHEN** an authenticated platform admin without `instanceId` calls `GET /api/v1/iam/users`
- **THEN** the system returns platform users from the platform identity provider
- **AND** it projects only platform-relevant roles such as `instance_registry_admin`
- **AND** it does not require or synthesize a tenant `instanceId`

#### Scenario: Tenant user list remains instance-scoped
- **WHEN** an authenticated tenant admin with `instanceId` calls `GET /api/v1/iam/users`
- **THEN** the system uses the existing tenant IAM read model for that `instanceId`
- **AND** it ignores platform-role information from the Root-Realm
