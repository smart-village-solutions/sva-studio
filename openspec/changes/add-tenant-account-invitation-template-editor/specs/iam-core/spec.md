## ADDED Requirements

### Requirement: Tenant-Vorlagen-API ist an die Session-Instanz gebunden

Die API SHALL `iam.invitationTemplate.manage` serverseitig für Lesen und Schreiben prüfen und die Instanz ausschließlich aus der authentifizierten Tenant-Session bestimmen. Sie SHALL die vorhandene Vorlagenvalidierung, scoped Datenbankzugriffe und optimistische Revisionierung verwenden. Ein Speichern SHALL keinen Keycloak-Write auslösen.

#### Scenario: Fremde Instanz wird angefordert

- **WHEN** ein Client eine `instanceId` im Tenant-Vorlagenaufruf angibt oder der Actor nicht zur Session-Instanz gehört
- **THEN** lehnt die API die Anfrage ab und ändert keine Vorlage

#### Scenario: Ungültige Vorlage oder veraltete Revision

- **WHEN** die Vorlage die Platzhalterregeln verletzt oder ihre erwartete Revision veraltet ist
- **THEN** antwortet die API mit einem Validierungsfehler beziehungsweise Konflikt
- **AND** bleibt der gespeicherte Text unverändert

#### Scenario: Gültiger Override

- **WHEN** ein berechtigter Tenant-Benutzer eine gültige Vorlage für seine Session-Instanz speichert
- **THEN** persistiert die API ausschließlich den Studio-Sollzustand dieser Instanz
- **AND** übernimmt der bestehende Einladungsversand diesen Text beim nächsten konkreten Versand
