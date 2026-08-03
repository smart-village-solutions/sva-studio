## ADDED Requirements

### Requirement: Allow-only Permission-Vertrag

Das System SHALL effektive Tenant-Permissions als Allow-Grants ohne fachliche Deny-Variante modellieren.

#### Scenario: Effektive Permission wird serialisiert

- **WHEN** eine effektive Permission über einen IAM-API-Vertrag serialisiert wird
- **THEN** enthält sie Action, Resource, optionalen Scope, optionale Organisation und Rollen-/Gruppen-Provenienz
- **AND** enthält sie kein `effect`-Feld und keine direkte Benutzer-Provenienz

#### Scenario: Fehlende Permission

- **WHEN** für eine Autorisierungsanfrage kein passender Allow-Grant existiert
- **THEN** wird die Anfrage verweigert
- **AND** es ist kein expliziter Deny-Grant erforderlich
