## ADDED Requirements
### Requirement: Limitbasierte Upload-Autorisierung

Das System SHALL Medien-Uploads zusätzlich zur IAM-Berechtigung gegen rollen- und instanzbezogene Limits prüfen.

#### Scenario: Upload-Limits ergänzen Medienberechtigung

- **WHEN** ein Benutzer ein neues Medium hochladen oder einen Upload initialisieren will
- **THEN** prüft das System zuerst die passende Medienberechtigung
- **AND** rollen- und instanzbezogene Rate- und Größenlimits werden serverseitig zusätzlich zur Berechtigung geprüft
- **AND** eine Limit-Ablehnung legt keine instanzfremden Nutzungsdaten offen
