## MODIFIED Requirements

### Requirement: Studio-Rollen-Lebenszyklus mit Keycloak-Synchronisierung

Das System MUST Rollen-CRUD für tenantlokale Custom-Rollen im Studio-IAM-Modell ausführen. Allgemeine Custom-Rollen werden nicht als Keycloak Realm Roles materialisiert; Keycloak-Abgleich bleibt auf technische Sonderrollen und Realm-Zugangskontrakte begrenzt.

#### Scenario: Custom-Rolle erstellen

- **WHEN** ein `system_admin` eine neue Custom-Rolle im Studio erstellt
- **THEN** wird die Rolle in `iam.roles` persistiert
- **AND** führt das System dafür keine allgemeine Keycloak-Realm-Rollenmutation aus
- **AND** behandelt es eine fehlende korrespondierende Keycloak-Rolle nicht als Drift des Sollmodells

#### Scenario: Custom-Rolle aktualisieren

- **WHEN** ein `system_admin` eine bestehende Custom-Rolle aktualisiert
- **THEN** werden die relevanten Metadaten im IAM-Rollenmodell konsistent aktualisiert
- **AND** ein technischer Keycloak-Call erfolgt nur, wenn ausdrücklich eine verbleibende Sonderrolle betroffen ist

#### Scenario: Custom-Rolle löschen

- **WHEN** ein `system_admin` eine löschbare Custom-Rolle entfernt
- **THEN** werden vor dem eigentlichen Rollen-Delete alle direkten Benutzerzuordnungen in `iam.account_roles` dieser Rolle entfernt
- **AND** werden vor dem eigentlichen Rollen-Delete alle Gruppenzuordnungen in `iam.group_roles` dieser Rolle entfernt
- **AND** wird die Rolle aus dem IAM-Speicher gelöscht
- **AND** wird keine allgemeine Keycloak-Realm-Rolle für diese Custom-Rolle erwartet oder entfernt
