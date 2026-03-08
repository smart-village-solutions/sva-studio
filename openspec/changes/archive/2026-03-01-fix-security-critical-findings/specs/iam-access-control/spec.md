## MODIFIED Requirements

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

#### Scenario: Keine internen Key-IDs in Exception-Messages

- **WHEN** ein Verschlüsselungs- oder Entschlüsselungsfehler im Field-Encryption-Modul auftritt
- **THEN** enthält die Exception-Message keine internen Key-IDs oder Keyring-Referenzen
- **AND** die Key-ID wird ausschließlich im strukturierten Debug-Log ausgegeben
