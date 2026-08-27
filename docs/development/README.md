# Entwicklung

## Bereichsvertrag

| Merkmal        | Festlegung                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Zweck          | Lokales Setup, Entwicklungsabläufe, Teststrategie, technische Qualitätsregeln und implementierungsnahe Verträge           |
| Zielgruppe     | Entwicklerinnen und Entwickler, technische Reviewer und Maintainer                                                        |
| Autorität      | Führend für die praktische Umsetzung; Architekturentscheidungen bleiben den arc42-Seiten und kanonischen ADRs vorbehalten |
| Ownership      | Das Team beziehungsweise Package, das den beschriebenen Entwicklungs- oder Testpfad besitzt                               |
| Pflege-Trigger | Änderungen an Toolchain, Workspace-Struktur, lokalen Laufzeitprofilen, Tests, Entwicklungs-APIs oder Qualitäts-Gates      |

Neue implementierungsnahe Dokumentation wird hier abgelegt. Betriebsanleitungen gehören nach [Betrieb](../operations/README.md), stabile Verträge nach [Referenz](../reference/README.md) und Prozessregeln nach [Governance](../governance/README.md).

## Einstieg und lokale Umgebung

- [Entwicklungs-Playbook](./playbook.md)
- [Runtime-Profile und Betriebsmodi](./runtime-profile-betrieb.md)
- [PostgreSQL-Setup](./postgres-setup.md)
- [Redis-Setup für lokale Entwicklung](../redis-setup.md)
- [Lokaler Dev-Auth-Modus](./lokaler-dev-auth-modus.md)
- [Monitoring-Stack](./monitoring-stack.md)
- [Observability Best Practices](./observability-best-practices.md)
- [App-E2E- und Integrationstests](./app-e2e-integration-testing.md)
- [Testing-Strategie](./testing-strategy.md)
- [Testing und Coverage](./testing-coverage.md)

## Server, IAM und Daten

- [IAM-Baseline-Seeding](./iam-baseline-seeding.md)
- [IAM-Schlüsselmanagement-Strategie](./iam-schluesselmanagement-strategie.md)
- [IAM-Server-Modularisierung](./iam-server-modularization.md)
- [Permission-Denial-Vertrag](./permission-denial-contract.md)
- [Plugin-Operations-Plattform](./plugin-operations-platform.md)
- [SVA-Mainserver-Runbook für Entwicklung](./runbook-sva-mainserver.md)
- [Server-Package-Runtime-Guards](./server-package-runtime-guards.md)
- [Studio-DB-Schema](./studio-db-schema.md)
- [SQL-Snapshot des Studio-DB-Schemas](./studio-db-schema-final.sql)
- [Waste-Management-Portierungsstrategie](./waste-management-portierungsstrategie.md)

## Studio-UI und Interaktionsverträge

- [Action Feedback](./action-feedback.md)
- [Builder.io lokal bearbeiten](./builder-io-local-editing.md)
- [Studio-Form-Migrationsinventur](./studio-form-migrationsinventur.md)
- [Studio-Foundations-Governance](./studio-foundations-governance.md)
- [Browser-Testgrundlage für Studio-Instanzen](./studio-instanz-browser-testgrundlage.md)
- [Standard für Studio-Listen](./studio-list-page-standard.md)
- [Inventar der Speicheraktionen](./studio-save-action-inventory.md)
- [Feedback für Studio-Speicheraktionen](./studio-save-feedback.md)
- [Standard für Übersichts- und Detailseiten](./studio-uebersichts-und-detailseiten-standard.md)
- [UI-Shell und Theming](./ui-shell-theming.md)

## Qualität, Reviews und Werkzeuge

- [Komplexitäts- und Qualitätsgovernance](./complexity-quality-governance.md)
- [Fallow-Agent-Integration](./fallow-agent-integration.md)
- [Fast-Check-Hotspots](./fast-check-hotspots.md)
- [Improve-Agent-Integration](./improve-agent-integration.md)
- [pnpm-Supply-Chain-Härtung](./pnpm-supply-chain-hardening.md)
- [Lokale Bearbeitung des Projektberichts](./project-report-lokale-bearbeitung.md)
- [QS-Mindeststandard](./qs-mindeststandard-sva-studio.md)
- [Review-Agent-Governance](./review-agent-governance.md)
- [SonarCloud Security Hotspots](./sonarcloud-security-hotspots.md)
- [Stagehand Admin Exploration](./stagehand-admin-exploration.md)

## Geplante Übernahmen aus `guides/`

Das vollständige und bis PR 4 verbindliche Alt-/Neu-Pfad-Inventar steht im [Migrationsinventar](../guides/README.md). Bis zur tatsächlichen Verschiebung bleiben die dort genannten Altpfade gültig.

Das [Redis-Setup für lokale Entwicklung](../redis-setup.md) liegt bis zur Bereinigung loser Dokumente in PR 4 noch direkt unter `docs/`, gehört inhaltlich aber bereits verbindlich zum Entwicklungsbereich.

## Benachbarte Bereiche

[Dokumentationsübersicht](../README.md) · [Betrieb](../operations/README.md) · [Referenz](../reference/README.md) · [Governance](../governance/README.md) · [Architektur](../architecture/README.md)
