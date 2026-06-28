## ADDED Requirements

### Requirement: Plugin-Vertrag unterscheidet Standard Path und Advanced Path

The plugin platform SHALL expose a documented Standard Path for typical plugin use cases and a documented Advanced Path for explicitly approved exceptions.

#### Scenario: Typisches Fachplugin nutzt den Standard Path

- **GIVEN** ein Plugin liefert deklarative Beitraege und optional React-Custom-Views
- **WHEN** es nur `@sva/plugin-sdk` und optional `@sva/studio-ui-react` als Workspace-Vertrag nutzt
- **THEN** faellt es unter den Standard Path
- **AND** es benoetigt keine weitergehende Host-Freigabe

#### Scenario: Plugin benoetigt erweiterte Runtime-Faehigkeit

- **GIVEN** ein Plugin benoetigt eine hostseitige Job-, Server- oder Integrationsfaehigkeit
- **WHEN** diese Faehigkeit nicht bereits als oeffentlicher Plugin-Vertrag dokumentiert ist
- **THEN** ist ein eigener OpenSpec-Change oder eine explizite Delta-Erweiterung erforderlich
- **AND** ein interner Importpfad ersetzt diese Freigabe nicht

### Requirement: Plugin-Boundary-Governance blockiert neue Drift

The plugin platform MUST enforce plugin architecture boundaries through a blocking validation that evaluates package dependencies, source imports, and host-signalling file structures.

#### Scenario: Neues Plugin fuehrt verbotene Host-Struktur ein

- **GIVEN** ein Plugin fuehrt einen Dateipfad wie `mainserver-*`, `plugin-catalog-*` oder `route-binding*` ein
- **WHEN** der Plugin-Architecture-Boundary-Check laeuft
- **THEN** blockiert der Check den Lauf als harten Host-Ownership-Verstoss

#### Scenario: Plugin nutzt review-pflichtiges Runtime-Signal

- **GIVEN** ein Plugin enthaelt eine Struktur wie `server.ts`, `plugin-operations.ts` oder `*.controller.ts`
- **WHEN** der Plugin-Architecture-Boundary-Check laeuft
- **THEN** ist diese Struktur nur mit dokumentierter Baseline-Ausnahme oder kuenftigem oeffentlichem Vertrag tolerierbar
- **AND** neue undokumentierte Faelle blockieren den Lauf
