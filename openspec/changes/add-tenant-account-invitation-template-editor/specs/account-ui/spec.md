## ADDED Requirements

### Requirement: Tenant verwaltet seine Account-Einladungsvorlage im Benutzerbereich

Das Studio SHALL unter `Benutzer -> Einladungsvorlage` einem Tenant-Benutzer mit `iam.invitationTemplate.manage` die wirksame Account-Einladungsvorlage, ihre Quelle und einen Editor mit sicherer Vorschau anzeigen. Speichern und Zurücksetzen SHALL nur den Override der eigenen Instanz mit Revisionsprüfung ändern.

#### Scenario: Berechtigter Tenant speichert die Vorlage

- **WHEN** ein Benutzer mit `iam.invitationTemplate.manage` eine gültige Vorlage speichert
- **THEN** speichert das Studio sie für seine Session-Instanz mit der gelesenen Revision
- **AND** zeigt die Seite die neue wirksame Vorlage und ihre Quelle

#### Scenario: Berechtigter Tenant setzt die Vorlage zurück

- **WHEN** der Benutzer den Reset bestätigt
- **THEN** entfernt das Studio nur den eigenen Instanz-Override
- **AND** zeigt die Seite die Servervorlage oder den SVA-Standard als geerbte Quelle

#### Scenario: Fehlende Berechtigung

- **WHEN** einem angemeldeten Benutzer `iam.invitationTemplate.manage` fehlt
- **THEN** erscheint der Menüpunkt nicht und die Route ist gesperrt
- **AND** lehnt die API Lesen und Schreiben ab, selbst wenn der Benutzer andere IAM-Rechte besitzt

#### Scenario: Konkurrierende Bearbeitung

- **WHEN** die gesendete Revision veraltet ist
- **THEN** bleibt die neuere Vorlage erhalten und die Seite lädt ihren aktuellen Stand neu
