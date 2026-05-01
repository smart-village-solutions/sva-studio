# @sva/iam-governance

`@sva/iam-governance` ist eine serverseitige Nx-Library für IAM-Governance, Rechtstexte, Data-Subject-Rights (DSR) und audit-nahe IAM-Fachfälle.

## Architektur-Rolle

Laut [Monorepo-Struktur](../../docs/monorepo.md) und [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md) ist `@sva/iam-governance` ein fachliches Domain-Package für Governance, Rechtstexte und DSR.

Die öffentliche Paketfassade in [src/index.ts](./src/index.ts) beschreibt die Rollen zusätzlich als `dsr`, `legal-texts`, `audit` und `governance-cases`.

Das Package trägt im Nx-Projekt die Tags `scope:iam-governance`, `type:lib` und `pii:yes` und ist damit ausdrücklich als fachliche Library mit personenbezogenen Datenflüssen markiert.

## Öffentliche API

Die öffentliche API wird über den Haupteinstieg `@sva/iam-governance` und dokumentierte Subpath-Exports aus [package.json](./package.json) bereitgestellt.

- Governance-Read-Modelle: `listGovernanceCases`, `GovernanceFilters`
- DSR-Read-Modelle: `listAdminDsrCases`, `loadDsrSelfServiceOverview`, `toCanonicalDsrStatus`, `DsrFilters`
- DSR-Exporte und Wartung: `collectDsrExportPayload`, `serializeDsrExportPayload`, `createDsrExportFlows`, `createDsrExportStatusHandlers`, `runDsrMaintenance`
- Governance-Workflows und Audit: `governanceWorkflowRoles`, `governanceReadRoles`, `governanceComplianceExportRoles`, `hasRequiredGovernanceRole`, `validateGovernanceTicketState`, `createGovernanceWorkflowExecutor`, `buildGovernanceComplianceExport`
- Rechtstexte: `hashLegalTextHtml`, `sanitizeLegalTextHtml`, `createLegalTextSchema`, `updateLegalTextSchema`, `createLegalTextRepository`, `createLegalTextMutationHandlers`, `createLegalTextHttpHandlers`
- Rechtstext-Kontext: `createLegalTextsAdminActorResolver`, `createLegalTextsRequestContextHandlers`, `withLegalTextsRequestContext`
- Weitere Exportpfade: `./read-models-internal`, `./dsr-read-models-internal`, `./governance-compliance-export`, `./legal-text-repository-shared` sowie die in [package.json](./package.json) definierten DSR-, Workflow- und Rechtstext-Subpfade

## Nutzung und Integration

Das Package ist als Node-ESM-Library mit `dist/index.js` als Laufzeiteinstieg konfiguriert und verwendet Workspace-Abhängigkeiten auf `@sva/core`, `@sva/data-repositories`, `@sva/iam-core` und `@sva/server-runtime`.

Die Implementierung ist in weiten Teilen dependency-injected aufgebaut. Beispiele dafür sind:

- `createGovernanceWorkflowExecutor`, das Logging-, UUID- und Kontext-Dependencies erwartet
- `createLegalTextRepository`, das eine instanzgebundene DB-Ausführung und Activity-Logging erhält
- `createLegalTextHttpHandlers` und `createLegalTextMutationHandlers`, die Request-, Response-, CSRF- und Idempotency-Helfer konsumieren

Die zugehörigen operativen und HTTP-seitigen Integrationspunkte sind in den IAM-Dokumenten beschrieben, unter anderem für:

- Governance-Feed und Compliance-Export
- DSR-Self-Service, Admin-Feed, Export-Status und Wartungslauf
- Rechtstext-Verwaltung unter `/api/v1/iam/legal-texts`

Die Zielarchitektur schreibt außerdem vor, dass App-Code IAM-Fachmodule wie `@sva/iam-governance` über Server-Funktionen konsumiert und nicht direkt im Browser-Bundle importiert.

## Projektstruktur

```text
packages/iam-governance/
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── read-models*.ts
    ├── dsr-*.ts
    ├── governance-*.ts
    ├── legal-text-*.ts
    ├── query-client.ts
    └── *.test.ts
```

Inhaltlich gliedert sich `src/` in vier Schwerpunkte:

- Governance-Feeds, Filter und Workflow-Ausführung
- DSR-Read-Modelle, Export-Flows, Export-Status und Wartung
- Rechtstext-Repository, HTTP-/Mutation-Handler, Request-Kontext und HTML-Sanitizing
- Paketinterne Mapper, Query-Module, Eingabeleser und Tests

## Nx-Konfiguration

Die Nx-Definition in [project.json](./project.json) registriert das Projekt als Library mit `sourceRoot` `packages/iam-governance/src`.

Verfügbare Targets:

- `build`: TypeScript-Build über `tsc -p packages/iam-governance/tsconfig.lib.json`
- `check:runtime`: Server-Runtime-Prüfung über `scripts/ci/check-server-package-runtime.ts --package iam-governance`
- `lint`: ESLint für `packages/iam-governance/src/**/*.{ts,tsx,js,jsx}`
- `test:unit`: Vitest-Lauf im Package-Verzeichnis
- `test:types`: TypeScript-Typprüfung ohne Emit
- `test:coverage`: Vitest mit Coverage

## Verwandte Dokumentation

- [Monorepo-Struktur](../../docs/monorepo.md)
- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Runtime View](../../docs/architecture/06-runtime-view.md)
- [IAM Governance Runbook](../../docs/guides/iam-governance-runbook.md)
- [IAM Data Subject Rights Runbook](../../docs/guides/iam-data-subject-rights-runbook.md)
- [IAM Authorization API Contract](../../docs/guides/iam-authorization-api-contract.md)
