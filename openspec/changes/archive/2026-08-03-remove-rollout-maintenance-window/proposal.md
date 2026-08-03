# Change: Wartungsfenster aus dem Studio-Rollout-Vertrag entfernen

## Why

Der kanonische Promote-Pfad erzwingt derzeit für Migrationen, Bootstraps und Production-Backup-Aufträge einen revisionsfähigen Wartungsfenster-Verweis. Dieser Verweis steuert weder Ausführungszeit noch Freigabe und verursacht deshalb vermeidbare Rollout-Abbrüche, obwohl die wirksamen Sicherheitsbarrieren bereits durch Environment-Freigabe, verifiziertes Backup, Staging-Parität, Postconditions und Digest-Prüfung abgedeckt sind.

## What Changes

- `maintenance_window` wird aus dem `Promote`-Workflow und der Rollout-Evidenz entfernt.
- Migrationen und Bootstraps in Staging und Production benötigen keinen Wartungsfenster-Verweis mehr.
- Production-Backup-Aufträge wechseln auf Vertragsversion 2 und werden ohne Wartungsfenster-Verweis erzeugt und validiert; der Agent akzeptiert alte Version-1-Aufträge während der Umstellung weiter.
- GitHub-Environment-Freigaben, Backup-Pflicht, mutierende Staging-Parität, Postconditions, Smoke-Prüfungen und Digest-Bindung bleiben unverändert fail-closed.
- Der separate Restore-Vertrag bleibt unverändert; Restore-Aufträge sind nicht Teil dieses Changes.

## Impact

- Affected specs: `deployment-topology`, `monorepo-structure`, `architecture-documentation`
- Affected code: `.github/workflows/promote.yml`, Backup-Agent-Vertrag und Submit-Skript, Workflow-/Vertragstests
- Affected docs: `docs/guides/studio-rollout-process.md`, arc42-Abschnitte 06, 07, 08 und 10 sowie zugehörige Betriebsdokumentation; Abschnitt 11 bleibt wegen seines Restore-Fokus unverändert
