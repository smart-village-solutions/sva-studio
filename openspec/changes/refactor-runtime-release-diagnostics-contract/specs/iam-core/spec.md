## MODIFIED Requirements

### Requirement: IAM Runtime Diagnostics

Der IAM-Diagnosekern SHALL öffentliche Fehlerklassifikationen, handlungsleitende Statuswerte, empfohlene Aktionen und allowlist-basierte sichere Details zentral in `@sva/core` definieren.

#### Scenario: Auth-Konfigurationsfehler wird klassifiziert

- **WHEN** ein IAM-naher Fehler einen Auth-Konfigurations- oder Auth-Auflösungsgrund meldet
- **THEN** klassifiziert der Diagnosekern den Fehler als `auth_resolution`
- **AND** überträgt nur freigegebene Details wie `reason_code` und `requestId`

#### Scenario: OIDC-Exchange-Fehler wird klassifiziert

- **WHEN** ein Login-, Discovery-, Token-Refresh- oder Token-Exchange-Fehler einen OIDC-Grund meldet
- **THEN** klassifiziert der Diagnosekern den Fehler als `oidc_discovery_or_exchange`
- **AND** empfiehlt eine erneute Anmeldung oder technische Prüfung passend zur Fehlerklasse

#### Scenario: Legacy-Workaround bleibt sichtbar

- **WHEN** ein Recovery- oder Fallback-Pfad einen Legacy- oder Workaround-Grund meldet
- **THEN** klassifiziert der Diagnosekern den Fehler als `legacy_workaround_or_regression`
- **AND** markiert den Zustand nicht als vollständig gesund
