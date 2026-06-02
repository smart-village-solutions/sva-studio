## MODIFIED Requirements

### Requirement: Organisationsarten und Basispolicies

Das System SHALL Organisationen mit einem kontrollierten Organisationstyp und organisationsbezogenen Basispolicies modellieren. `content_author_policy` bleibt Teil der Organisationsrepräsentation und steuert neben der fachlichen Autorenschaft auch die Auflösung der effektiven Mainserver-Credentials im aktiven Organisationskontext.

#### Scenario: Kommunale Organisation mit Typ anlegen

- **WHEN** ein Administrator eine Organisation vom Typ `municipality` oder einem äquivalenten unterstützten Typ anlegt
- **THEN** wird der Typ zusammen mit der Organisation gespeichert
- **AND** die Organisation bleibt für Hierarchie- und Filteroperationen nach Typ auswertbar

#### Scenario: Ungültiger Organisationstyp wird abgewiesen

- **WHEN** ein Administrator einen nicht unterstützten Organisationstyp speichert
- **THEN** wird die Operation mit einem Validierungsfehler abgewiesen
- **AND** die Daten bleiben unverändert

#### Scenario: Organisationsbezogene Autorenpolicy steuert auch Mainserver-Credentials

- **WHEN** ein Administrator für eine Organisation eine `content_author_policy` speichert
- **THEN** wird die Policy in der Organisationsrepräsentation persistiert
- **AND** nachgelagerte Module können diese Policy als organisationsbezogenen Kontext für Autorenschaft und Mainserver-Credential-Auflösung konsumieren

## ADDED Requirements

### Requirement: Geschützter Mainserver-Credential-Speicher pro Organisation

Das System SHALL organisationsgebundene Mainserver-Credentials in einem dedizierten serverseitigen Speicher der Studio-Datenbank halten und nicht in `iam.organizations.metadata` ablegen. Die Application-ID ist organisationsgebunden lesbar; das Secret wird ausschließlich als Ciphertext gespeichert und über Read-Models nur als Zustandsinformation exponiert.

#### Scenario: Administrator speichert Mainserver-Credentials für eine Organisation

- **WHEN** ein berechtigter Administrator Mainserver-Credentials für eine Organisation der aktiven `instanceId` speichert
- **THEN** persistiert das System die Application-ID organisationsgebunden
- **AND** das Secret wird ausschließlich als verschlüsselter Ciphertext gespeichert
- **AND** generische Organisations-Responses enthalten nie das Klartext-Secret

#### Scenario: Organisationsdetail liefert nur einen write-sicheren Credential-Status

- **WHEN** ein berechtigter Administrator das Organisationsdetail lädt
- **THEN** enthält das Read-Model höchstens `mainserverApplicationId` und `mainserverApplicationSecretSet`
- **AND** der Response enthält kein Klartext-Secret und keinen generischen Secret-Dump
