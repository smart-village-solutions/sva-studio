# Change: Runtime-Principal nach Datenbankrestore sicher abgleichen

## Why

Der Production-Restore vom 1. August 2026 wurde erfolgreich gemeldet, obwohl der wiederhergestellte Dump keine ACL-Einträge enthielt und der laufende App-Principal anschließend keinen Zugriff auf das Schema `iam` hatte. Die bisherigen Principal- und Health-Prüfungen erkennen diesen Zustand nicht zuverlässig und erzeugen dadurch eine falsche positive Restore-Evidenz.

## What Changes

- Der Backup-/Restore-Agent rekonstruiert nach `pg_restore` die fest allowlisteten IAM-Rechte des Runtime-Principals idempotent.
- Principal, Datenbank, Schema, Rollen und SQL-Anweisungen bleiben umgebungsgebunden und dürfen nicht aus dem Restore-Request stammen.
- Der Agent validiert Schema-, Rollen-, Tabellen- und Sequenzrechte datenbanknah, bevor er einen Restore als erfolgreich meldet.
- Der Agent benötigt dafür keine App-Zugangsdaten; er nutzt ausschließlich seinen bestehenden eingeschränkten Restore-Pfad und den fest konfigurierten Schema-Owner-Kontext.
- Die Restore-Evidenz weist ACL-Reconciliation und Principal-Probe getrennt und redigiert aus.
- Nach dem Neustart prüft der GitHub-Workflow zusätzlich einen authentifizierten IAM-Anwendungspfad; allgemeine Health- und Login-Redirect-Prüfungen reichen nicht aus.
- Staging- und Production-Restores werden unabhängig autorisiert und geprüft; kein Restore verlangt Evidenz aus der jeweils anderen Umgebung.
- Jeder Fehler hält die Anwendung fail-closed im Wartungszustand.

## Impact

- Affected specs: `deployment-topology`
- Affected code: zentraler Backup-/Restore-Agent, `.github/workflows/database-restore.yml`, Restore-Vertrags- und Evidenztypen unter `scripts/ci/`
- Affected documentation: `docs/adr/ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md`, `docs/guides/swarm-deployment-runbook.md`, `docs/guides/studio-rollout-process.md`
- Affected arc42 sections: `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`
- Security impact: Der bestehende Restore-Agent erhält keine allgemeine SQL-Schnittstelle und keine App-Zugangsdaten. Seine feste Restore-Verantwortung wird um eine eng begrenzte, idempotente ACL-Reconciliation erweitert.
