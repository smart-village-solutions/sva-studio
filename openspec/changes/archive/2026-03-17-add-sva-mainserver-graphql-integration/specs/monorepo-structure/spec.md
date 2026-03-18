## ADDED Requirements

### Requirement: Dediziertes SVA-Mainserver-Integrationspaket

Das System SHALL ein eigenes Workspace-Paket `packages/sva-mainserver` mit dem
Importpfad `@sva/sva-mainserver` bereitstellen.

#### Scenario: Paket und Nx-Projekt vorhanden

- **WHEN** das Workspace geladen wird
- **THEN** existiert ein Nx-Projekt `sva-mainserver`
- **AND** das Package trägt den Namen `@sva/sva-mainserver`
- **AND** das Projekt ist mit `scope:integration` und `type:lib` getaggt

#### Scenario: Öffentliche Root- und Server-Exports sind getrennt

- **WHEN** ein Modul Typen und Verträge des Mainserver-Pakets importiert
- **THEN** kann es `@sva/sva-mainserver` für client-sichere Exporte verwenden
- **AND** serverseitige Adapter werden ausschließlich über `@sva/sva-mainserver/server` importiert

### Requirement: Konsistente Workspace-Auflösung für Mainserver-Integrationen

Das System SHALL die Mainserver-Integrationspfade in der Workspace-Konfiguration
typsicher auflösen.

#### Scenario: TypeScript-Path-Mappings vorhanden

- **WHEN** ein Workspace-Modul `@sva/sva-mainserver` oder `@sva/sva-mainserver/server` importiert
- **THEN** existieren korrespondierende Einträge in `tsconfig.base.json`
- **AND** Build, Type-Check und IDE-Auflösung funktionieren ohne lokale Sonderkonfiguration

### Requirement: Datenbankzugriff ausschließlich über `@sva/data`-Repository

Das System SHALL alle Datenbankzugriffe des Mainserver-Pakets über das
bestehende Repository in `@sva/data` abwickeln. Das Paket `@sva/sva-mainserver`
führt keine eigene `pg`-Dependency und keinen eigenen Connection-Pool.

#### Scenario: Keine direkte pg-Dependency im Mainserver-Paket

- **WHEN** die `package.json` von `@sva/sva-mainserver` geprüft wird
- **THEN** enthält sie `pg` weder in `dependencies` noch in `peerDependencies`
- **AND** Zugriffe auf `iam.instance_integrations` laufen über das Repository in `@sva/data`

### Requirement: Coverage-Baseline für Mainserver-Paket

Das System SHALL eine Coverage-Baseline für `@sva/sva-mainserver` in
`coverage-policy.json` führen, damit der Coverage-Gate das Paket validiert.

#### Scenario: Coverage-Policy-Eintrag vorhanden

- **WHEN** der Coverage-Gate ausgeführt wird
- **THEN** existiert ein Eintrag für `@sva/sva-mainserver` in `tooling/testing/coverage-policy.json`
- **AND** die definierten Schwellwerte werden geprüft

### Requirement: Dockerfile enthält Build-Step für Mainserver-Paket

Das System SHALL den Build des Mainserver-Pakets im Produktions-Dockerfile
berücksichtigen, damit der Container korrekt deployed werden kann.

#### Scenario: Build-Step im Dockerfile vorhanden

- **WHEN** das Produktions-Dockerfile ausgeführt wird
- **THEN** wird `pnpm nx run sva-mainserver:build` als Build-Step ausgeführt
- **AND** der Step steht in der korrekten Abhängigkeitsreihenfolge (nach `auth:build`, vor `plugin-example:build`)
