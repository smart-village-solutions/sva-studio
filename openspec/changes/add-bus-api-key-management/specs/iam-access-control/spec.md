## ADDED Requirements

### Requirement: Plattformgebundene Bus-Key-Administration

Das System SHALL sämtliche Bus-Key-Lese- und Schreibendpunkte ausschließlich für
authentifizierte Root-Host-Sessions mit der Plattformrolle `instance_registry_admin`
freigeben. Tenant-Permissions und ein übermittelter Actor-Header SHALL keine Freigabe ersetzen.

#### Scenario: Direkter Request eines Tenant-Administrators

- **WHEN** ein Tenant-Administrator einen Bus-Key-Endpunkt direkt aufruft
- **THEN** wird der Request vor jedem Bus-Aufruf abgelehnt
- **AND** bleibt dies auch mit `system_admin` oder nachgebildetem Actor-Header der Fall

#### Scenario: Mutation ohne CSRF oder frische Reauthentisierung

- **WHEN** eine angemeldete Plattform-Session die bestehende CSRF- oder erforderliche Fresh-Reauth-Prüfung nicht erfüllt
- **THEN** wird die Bus-Key-Mutation vor dem Downstream-Aufruf abgelehnt

### Requirement: Registrygebundene Bus-Aufrufe und geschützte technische Credentials

Das System SHALL Registry-Existenz und Instanzstatus vor dem Bus-Aufruf prüfen,
`owner` und `label` selbst ableiten und bei Listen sowie Sperren/Reaktivieren immer den
exakten Label-Kontext verwenden. Technische Credentials SHALL ausschließlich im Server bleiben.

#### Scenario: Fremde Key-ID oder manipulierte Metadaten

- **WHEN** ein Request eine andere Key-ID oder abweichende `owner`-/`label`-Werte enthält
- **THEN** überschreibt dies nicht den geprüften Instanzkontext
- **AND** verhindert die Label-Vorbedingung eine Mutation eines fremden Keys

#### Scenario: Instanz ist suspendiert oder archiviert

- **WHEN** eine bekannte Instanz nicht aktiv ist
- **THEN** bleiben Lesen und Sperren für den berechtigten Plattform-Superadmin möglich
- **AND** sind Erstellen und Reaktivieren gesperrt

#### Scenario: Browser erhält ein Verwaltungsergebnis

- **WHEN** Studio ein Bus-Key-Verwaltungsergebnis an den Browser liefert
- **THEN** enthält es keinen technischen Bus-Admin-Token und keine Key-Hashes
- **AND** ist es mit `Cache-Control: no-store` geschützt
- **AND** erscheinen Klartext-Keys nur in der erfolgreichen einmaligen Erstellantwort
