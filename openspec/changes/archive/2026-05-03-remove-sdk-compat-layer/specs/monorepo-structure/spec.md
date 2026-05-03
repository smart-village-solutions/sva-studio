## MODIFIED Requirements
### Requirement: SDK-Compatibility-Layer bleibt begrenzt und deprectated

Das System MUST alte Sammelimporte aus `@sva/auth`, `@sva/data` und `@sva/sdk` fuer migrierte Verantwortlichkeiten entfernen. `@sva/sdk` wird nicht mehr als aktives Workspace-Paket gefuehrt.

#### Scenario: SDK-Compatibility-Layer wird entfernt

- **WHEN** der Hard-Cut fuer `@sva/sdk` abgeschlossen ist
- **THEN** existiert im aktiven Workspace kein Paket `@sva/sdk` mehr
- **AND** neue oder bestehende Zielpackages verwenden keine `@sva/sdk`-Importe

#### Scenario: Plugin oder Runtime-Consumer migriert einen Altimport

- **WHEN** ein Consumer bisher `@sva/sdk` oder einen Subpath daraus referenziert hat
- **THEN** nutzt er direkt `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core` oder `@sva/monitoring-client/logging`
- **AND** es wird keine neue Sammelfassade eingefuehrt
