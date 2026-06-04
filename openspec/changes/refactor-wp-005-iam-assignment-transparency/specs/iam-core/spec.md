## MODIFIED Requirements
### Requirement: Keycloak Admin API Integration

Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Rollen und Rollenzuordnungen im jeweiligen Platform- oder Tenant-Scope vollständig listen, bearbeiten und synchronisieren zu können. Keycloak bleibt System of Record für Identitäten und Realm-Rollen; Studio stellt eine auditierte Admin-UI und synchronisierte Fachansicht bereit.

#### Scenario: Benutzerupdate erhält fachlich unveränderte Rollen- und Gruppenzuweisungen

- **WHEN** ein berechtigter Admin einen bestehenden Benutzer aktualisiert und eine bereits vorhandene Rollen- oder Gruppenzuordnung fachlich unverändert bestehen bleibt
- **THEN** ersetzt das System diese Zuordnung nicht blind durch Löschen und Neuanlegen
- **AND** bleiben vorhandene Assignment-Metadaten wie Ursprung und Gültigkeitsfenster erhalten

#### Scenario: Benutzerupdate schreibt nur die fachliche Differenz

- **WHEN** ein berechtigter Admin bei einem bestehenden Benutzer Rollen oder Gruppen gezielt hinzufügt, entfernt oder ändert
- **THEN** persistiert das System nur die fachliche Differenz der betroffenen Zuordnungen
- **AND** bleiben nicht geänderte Zuordnungen unverändert bestehen
- **AND** werden nachgelagerte Invalidierungen und Synchronisationsschritte nur für den betroffenen Benutzerkontext ausgelöst

### Requirement: Permission-Metadaten beschreiben die Laufzeitsemantik explizit

Das System MUST für verwaltete IAM-Permissions explizit ausweisen, ob sie instanzweit, datensatzbezogen oder organisationskontextbezogen ausgewertet werden.

#### Scenario: Rollen- und Transparenzmodelle tragen `runtimeScope`

- **WHEN** verwaltete Permissions über Rollenlisten, Permissions-Listen oder Benutzer-Detail-Transparenzmodelle zurückgegeben werden
- **THEN** enthält jeder Eintrag eine explizite Laufzeitklassifikation `instance | record | organization_context`
- **AND** dürfen neue verwaltete Permission-Keys nicht stillschweigend ohne diese Klassifikation eingeführt werden
