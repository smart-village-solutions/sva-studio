## MODIFIED Requirements
### Requirement: Organisations-CRUD für Administratoren

Das System SHALL eine instanzgebundene Organisationsverwaltung über dedizierte Admin-Endpunkte bereitstellen. Löschungen bleiben für Organisationen mit untergeordneten Children gesperrt; löschbare Blatt-Organisationen werden physisch entfernt.

#### Scenario: Organisation anlegen

- **WHEN** ein berechtigter Administrator `POST /api/v1/iam/organizations` mit gültigen Daten aufruft
- **THEN** wird eine neue Organisation in der aktiven `instanceId` angelegt
- **AND** die Antwort enthält die gespeicherte Organisationsrepräsentation

#### Scenario: Organisation bearbeiten

- **WHEN** ein berechtigter Administrator `PATCH /api/v1/iam/organizations/:organizationId` mit gültigen Änderungen aufruft
- **THEN** werden Name, Parent oder freigegebene Metadaten aktualisiert
- **AND** die Instanzgrenze bleibt unverändert

#### Scenario: Organisation mit abhängigen Children kann nicht unkontrolliert gelöscht werden

- **WHEN** ein Administrator eine Organisation mit untergeordneten Organisationen löschen will
- **THEN** erzwingt das System eine definierte Konflikt- oder Schutzreaktion
- **AND** die Hierarchie bleibt konsistent

#### Scenario: Delete-Endpunkt löscht zulässige Blatt-Organisationen physisch

- **WHEN** ein berechtigter Administrator `DELETE /api/v1/iam/organizations/:organizationId` für eine zulässige Organisation ohne Children aufruft
- **THEN** wird die Organisation physisch gelöscht statt deaktiviert
- **AND** setzt das System vorher referenzierende Content-Organisationen kontrolliert auf `NULL`
- **AND** werden Memberships und organisationsgebundene Credentials über bestehende Löschregeln entfernt
