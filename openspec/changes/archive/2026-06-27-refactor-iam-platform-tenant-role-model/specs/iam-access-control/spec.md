## ADDED Requirements
### Requirement: Plattformrecht instance.registry.manage ist nicht tenantfähig
Das System SHALL das Recht `instance.registry.manage` ausschließlich im Plattform-/Root-Scope auswerten. Tenantlokale Rollen, Gruppen oder Permissions dürfen dieses Recht nicht verleihen.

#### Scenario: Tenant-Rolle kann Instanzverwaltung nicht freischalten
- **WHEN** eine tenantlokale Rolle, Gruppe oder Permission-Zuordnung versucht, `instance.registry.manage` oder einen gleichwertigen Instanzverwaltungszugriff zu modellieren
- **THEN** behandelt das System diesen Zustand nicht als wirksame tenantlokale Berechtigung
- **AND** ein tenantseitiger Request auf Root-Control-Plane-Funktionalität bleibt fail-closed verweigert

#### Scenario: Root-Instanzverwaltung bleibt auf Plattformrolle begrenzt
- **WHEN** ein Root-Host-Request eine Instanzverwaltungsoperation ausführt
- **THEN** entscheidet das System den Zugriff ausschließlich über die Plattformrolle `instance_registry_admin`
- **AND** tenantlokale Permission-Snapshots oder Gruppenmitgliedschaften werden dafür nicht ausgewertet

### Requirement: Tenantseitige Modulrechte sind von kanonischen Standardrollen entkoppelt
Das System SHALL tenantseitige modulbezogene Rechte so modellieren, dass sie individuellen Rollen und Gruppen einer Instanz zugeordnet werden können, ohne kanonische Standardrollen als normative Rechtequelle zu verlangen.

#### Scenario: Modulrecht wird einer individuellen Tenant-Rolle zugeordnet
- **WHEN** ein Administrator einer Instanz ein modulbezogenes Recht einer editierbaren Custom-Rolle zuweist
- **THEN** wird dieses Recht serverseitig wie jede andere tenantlokale Rollen-Permission-Zuordnung persistiert und ausgewertet
- **AND** es ist dafür keine kanonische Standardrolle wie `editor` oder `app_manager` erforderlich

#### Scenario: Gruppen vermitteln modulbezogene Rechte ohne Standardrollenpflicht
- **WHEN** eine Gruppe tenantlokale Rollen bündelt, die modulbezogene Rechte enthalten
- **THEN** erhält der Benutzer die entsprechenden Rechte über die Gruppenauflösung
- **AND** die Wirksamkeit hängt nicht davon ab, ob eine kanonische Standardrolle existiert

### Requirement: Geschützte Tenant-Sonderrollen bleiben von frei verwaltbaren Rollen unterscheidbar
Das System SHALL tenantlokale geschützte Sonderrollen wie `system_admin` von frei verwaltbaren tenantlokalen Rollen unterscheiden.

#### Scenario: system_admin bleibt gesondert geschützt
- **WHEN** ein Benutzer oder eine Rolle im Tenant-Realm verwaltet wird
- **THEN** behandelt das System `system_admin` weiterhin als geschützte Sonderrolle
- **AND** Sonderregeln wie Letztadmin-Schutz oder strengere Verwaltungsprüfungen bleiben erhalten
- **AND** die geschützte Rolle bündelt direkt alle tenantlokalen Permissions des aktiven Sollzustands

#### Scenario: Individuelle Tenant-Rollen bleiben editierbar
- **WHEN** eine tenantlokale Custom-Rolle ohne Sonderstatus gelesen oder bearbeitet wird
- **THEN** bleibt sie über die normale Rollenverwaltung editierbar
- **AND** ihre Rechtebasis kann unabhängig von kanonischen Standardrollen gepflegt werden

### Requirement: system_admin ist die normative Vollzugriffsrolle im Tenant
Das System SHALL `system_admin` als normative tenantlokale Vollzugriffsrolle behandeln. Die effektive Permission-Menge von `system_admin` MUST mindestens alle tenantlokalen Core-, Verwaltungs- und Modul-Permissions umfassen, die über tenantseitige UI- und API-Gates relevant sind.

#### Scenario: UI-Gate akzeptiert system_admin ohne Nebenartefakte
- **WHEN** ein UI- oder API-Gate auf eine tenantlokale Verwaltungs- oder Modul-Permission prüft
- **THEN** erhält ein Benutzer mit `system_admin` die Freigabe auch dann, wenn keine zusätzliche Gruppe wie `admins` und keine ergänzende Rolle wie `core_admin` zugewiesen ist

#### Scenario: Komfortgruppen bleiben optional
- **WHEN** eine Tenant-Instanz Gruppen oder Standardrollen als Komfortbündel für Administratoren verwendet
- **THEN** dürfen diese Artefakte weiterhin Permissions vermitteln
- **AND** sie sind nicht die normative Quelle dafür, dass ein `system_admin` vollen Zugriff besitzt

## MODIFIED Requirements
### Requirement: Plattformrollen und Tenant-Admin-Rollen bleiben getrennt
Das System SHALL tenant-lokale Admin-Rollen und globale Plattformrollen in der Instanzverwaltung strikt trennen. `instance_registry_admin` ist eine reine Plattformrolle des Root-Realm. `system_admin` ist die geschützte tenantlokale Vollzugriffs- und Defaultrolle des Tenant-Realm.

#### Scenario: Nur Plattform-Admin darf Keycloak-Provisioning anstossen
- **WHEN** ein Benutzer ohne `instance_registry_admin` im Root-Realm versucht, Instanz-Realm-Grundeinstellungen zu ändern oder ein Keycloak-Provisioning auszulösen
- **THEN** lehnt das System die Operation ab

#### Scenario: Tenant-Admin-Rechte ersetzen keine Plattformrechte
- **WHEN** ein Benutzer im Tenant-Realm `system_admin` oder andere tenantlokale Verwaltungsrechte besitzt
- **THEN** darf er dadurch keine Root-Control-Plane- oder Instanzverwaltungsfunktion auslösen
- **AND** tenantlokale Verwaltungsrechte eskalieren nicht in den Plattform-Scope
