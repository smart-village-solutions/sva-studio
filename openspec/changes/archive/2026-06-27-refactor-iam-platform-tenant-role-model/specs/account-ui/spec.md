## ADDED Requirements
### Requirement: Tenant-Rollenverwaltung zeigt keine Root-Plattformrolle als tenantlokales Artefakt
Das System SHALL in tenantlokalen Rollen- und Benutzerverwaltungsansichten die Plattformrolle `instance_registry_admin` nicht als zuweisbare Tenant-Rolle darstellen.

#### Scenario: Tenant-Rollenliste blendet Root-Plattformrolle aus
- **WHEN** ein Administrator die tenantlokale Rollenverwaltung unter `/admin/roles` öffnet
- **THEN** erscheint `instance_registry_admin` dort nicht als tenantseitig verwaltbare Rolle
- **AND** die Ansicht bleibt auf tenantlokale Rollen des aktiven Tenant-Realm beschränkt

#### Scenario: Tenant-Benutzerbearbeitung bietet keine Root-Plattformrolle an
- **WHEN** ein Administrator im Tenant-Realm Rollen für einen Benutzer bearbeitet
- **THEN** ist `instance_registry_admin` nicht als auswählbare Rollenzuweisung verfügbar
- **AND** die UI behandelt tenantlokale und Root-Rollen nicht als gemeinsamen Katalog

### Requirement: Tenant-Rollenverwaltung erlaubt individuelle Rechtezuschnitte ohne Standardrollenpflicht
Das System SHALL in der tenantlokalen Rollenverwaltung die Zuordnung von Rechten zu individuellen Rollen unterstützen, ohne kanonische Standardrollen als Primärmodell vorauszusetzen.

#### Scenario: Individuelle Rolle erhält modulbezogene Rechte
- **WHEN** ein Administrator eine editierbare tenantlokale Rolle erstellt oder bearbeitet
- **THEN** kann er modulbezogene und tenantlokale Rechte direkt über die Rollenverwaltung zuweisen
- **AND** die UI verlangt dafür keine Auswahl oder Kopplung an Rollen wie `editor`, `designer` oder `app_manager`

### Requirement: UI-Gates behandeln system_admin als vollständigen Tenant-Vollzugriff
Das System SHALL tenantlokale Navigations-, Aktions- und Verwaltungs-Gates so auswerten, dass ein Benutzer mit `system_admin` die vollständigen vorgesehenen Tenant-Admin-Funktionen nutzen kann, ohne zusätzliche versteckte Rollen- oder Gruppenabhängigkeiten.

#### Scenario: Sidebar und Admin-Funktionen bleiben für system_admin sichtbar
- **WHEN** ein Benutzer im Tenant-Realm ausschließlich `system_admin` besitzt
- **THEN** bleiben die für Tenant-Administratoren vorgesehenen Navigationspunkte, Verwaltungsseiten und Aktionen sichtbar und nutzbar
- **AND** ihre Verfügbarkeit hängt nicht zusätzlich von Gruppen wie `admins` oder Rollen wie `core_admin` ab

## MODIFIED Requirements
### Requirement: Rollen-Verwaltungsseite
Das System MUST eine tenantlokale Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von tenantlokalen System- und Custom-Rollen ermöglicht. Root-/Plattformrollen werden dort nicht als tenantlokale Bearbeitungsobjekte behandelt.

#### Scenario: Rollenverwaltung bleibt tenantlokal
- **WENN** ein Administrator `/admin/roles` im Tenant-Realm öffnet
- **DANN** zeigt die Seite tenantlokale Rollen des aktiven Tenant-Realm
- **UND** Root-/Plattformrollen wie `instance_registry_admin` werden dort nicht als bearbeitbare tenantlokale Rollen eingeblendet

#### Scenario: Sichtbare Rollendetails bleiben tenantbezogen
- **WENN** die Detailansicht einer tenantlokalen Rolle geladen wird
- **DANN** sind mindestens `externalRoleName`, `managedBy`, `roleLevel`, Sync-Zustand und Mitgliederzahl sichtbar
- **UND** beziehen sich diese Informationen ausschließlich auf tenantlokale Rollenartefakte
