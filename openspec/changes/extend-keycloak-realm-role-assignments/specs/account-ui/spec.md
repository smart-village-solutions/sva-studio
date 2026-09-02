## MODIFIED Requirements

### Requirement: Studio Keycloak Admin UI

Die Studio-Admin-UI SHALL berechtigten Plattform- und Tenant-Administratoren das Studio als alternative Oberfläche für die jeweils zulässige Keycloak-Benutzer- und Rollenadministration bereitstellen.

#### Scenario: Vollständige Benutzerliste mit getrennten Rollensichten

- **WHEN** ein Admin `/admin/users` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-Benutzer einschließlich noch nicht lokal gemappter App-Benutzer
- **AND** bietet Such-, Status-, Rollen- und Mapping-Filter
- **AND** zeigt lokale IAM-Rollen sowie direkte und geerbte Keycloak-Realm-Rollen getrennt an
- **AND** zeigt pro Benutzer, ob Profilbearbeitung, Deaktivierung und die jeweilige Rollenzuordnung möglich, read-only oder blockiert ist

#### Scenario: Vollständige Rollenliste mit Bearbeitbarkeitsstatus

- **WHEN** ein Admin `/admin/roles` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-Realm-Rollen mit Such-, Typ- und Bearbeitbarkeitsfiltern
- **AND** unterscheidet Keycloak-Builtins, externe, Studio-managed, technische Service- sowie Root-/Plattformrollen sichtbar
- **AND** zeigt sie auch dann read-only an, wenn ihre Definition oder Zuweisung im Tenant nicht verändert werden darf

#### Scenario: Berechtigter Admin verwaltet direkte externe Zuweisung

- **GIVEN** ein Admin besitzt effektiv `iam.role.write`
- **WHEN** er für einen gemappten oder unmapped Tenant-Benutzer eine zuweisbare Realm-Rolle auswählt
- **THEN** kann er die direkte Zuweisung ohne zusätzlichen Freigabeschritt erteilen oder entziehen
- **AND** erhält er eine zugängliche Rückmeldung über bestätigten Erfolg, Ablehnung oder einen unklaren Upstream-Zustand

#### Scenario: Direkte und geerbte Rolle sind unterscheidbar

- **WHEN** ein Benutzer eine Realm-Rolle direkt, geerbt oder zugleich direkt und geerbt besitzt
- **THEN** kennzeichnet die UI die jeweilige Herkunft ohne ausschließlich farbliche Unterscheidung
- **AND** bietet sie für eine ausschließlich geerbte Rolle keinen irreführenden direkten Entzug an
- **AND** benennt sie bei einer zusätzlichen direkten Zuweisung die verbleibende Composite-Wirkung verständlich

#### Scenario: system_admin verwendet geschützten Zuweisungspfad

- **WHEN** `system_admin` in der Benutzer- oder Rollenansicht verwaltet wird
- **THEN** bleibt die Rolle sichtbar und für zulässige gemappte Tenant-Konten zuweisbar
- **AND** erklärt die UI fehlende Actor-Berechtigung, unmapped Zielkonten und Letztadmin-Schutz konkret
- **AND** suggeriert sie keinen generischen externen Keycloak-only-Pfad

#### Scenario: Sync-Diagnosen sind handlungsleitend

- **WHEN** ein Sync, Reconcile oder Keycloak-Re-Read `partial_failure`, `blocked`, `failed` oder einen unklaren Zustand meldet
- **THEN** zeigt die UI Zähler, Diagnosecodes und betroffene Benutzer oder Rollen
- **AND** bietet nur Aktionen an, die im aktiven Scope und laut Bearbeitbarkeitsmatrix erlaubt sind

### Requirement: Rollenanzeigen nutzen eine kanonische Fachsicht

Das System SHALL in Profil-, Session- und Tenant-Admin-Ansichten lokale IAM-Rollen und externe Keycloak-Rollen klar trennen. Lokale IAM-Rollen und effektive Permissions bleiben die kanonische Studio-Fachsicht; Keycloak-Rollen werden als technische oder anwendungsbezogene Interop-Sicht dargestellt.

#### Scenario: Account-Seite zeigt fachlich kanonische Rollen

- **WHEN** ein authentifizierter Tenant-Benutzer `/account` aufruft
- **THEN** zeigt die Seite die kanonischen tenantlokalen Rollen aus dem IAM-Modell an
- **AND** umfasst diese kanonische Sicht auch implizite Rollenwirkung aus Gruppenzuordnungen
- **AND** zeigt die Seite rohe Keycloak-Rollen in einer getrennten technischen oder anwendungsbezogenen Ansicht
- **AND** werden Keycloak-Rollen nicht unkommentiert als normale Studio-Fachrollen dargestellt

#### Scenario: Admin-Ansicht unterscheidet kanonische und externe Rollen

- **WHEN** eine Benutzer- oder Rollenansicht lokale IAM- und Keycloak-Rollen anzeigt
- **THEN** sind beide Rollensichten eindeutig getrennt beschriftet
- **AND** bleibt für Administratoren erkennbar, welche Sicht für Studio-Autorisierung normativ ist
- **AND** sind direkte, geerbte, externe, Studio-managed und geschützte Keycloak-Rollen zugänglich unterscheidbar

#### Scenario: Zuweisbarkeit ändert keine Autorisierungskennzeichnung

- **WHEN** eine externe Keycloak-Rolle im Studio direkt zuweisbar ist
- **THEN** bezeichnet die UI sie weiterhin als externe Interop-Rolle
- **AND** behauptet sie keine Wirkung auf lokale Studio-Permissions
