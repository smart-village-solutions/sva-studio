## MODIFIED Requirements
### Requirement: Organisations-Mutationen

Das System SHALL Organisationen instanzgebunden anlegen, ändern und löschen können. Löschungen bleiben für Organisationen mit untergeordneten Children gesperrt; löschbare Blatt-Organisationen werden physisch entfernt.

#### Scenario: Organisation mit abhängigen Children kann nicht unkontrolliert gelöscht werden

- **WHEN** ein Administrator eine Organisation mit untergeordneten Organisationen löschen will
- **THEN** erzwingt das System eine definierte Konflikt- oder Schutzreaktion
- **AND** die Hierarchie bleibt konsistent

#### Scenario: Delete-Endpunkt löscht zulässige Blatt-Organisationen physisch

- **WHEN** ein berechtigter Administrator `DELETE /api/v1/iam/organizations/:organizationId` für eine zulässige Organisation ohne Children aufruft
- **THEN** wird die Organisation physisch gelöscht statt deaktiviert
- **AND** setzt das System vorher referenzierende Content-Organisationen kontrolliert auf `NULL`
- **AND** werden Memberships und organisationsgebundene Credentials über bestehende Löschregeln entfernt
