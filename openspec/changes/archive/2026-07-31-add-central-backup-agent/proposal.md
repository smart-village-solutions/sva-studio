# Change: Zentralen Backup-Agenten für Staging und Production einführen

## Why

Der aktuelle Promote-Pfad startet für jedes benötigte Backup einen kurzlebigen Swarm-Stack. Der Ablauf ist zwar fail-closed, aber die operative Diagnose hängt an einer flüchtigen Task- und Log-Kette. Ein dauerhafter, beobachtbarer Ausführungspunkt soll Backups für Staging und Production zuverlässig ausführen und den Promote-Pfad auf einen belegbaren Backup-Auftrag reduzieren.

## What Changes

- Ein einmalig betriebener, zentraler `studio-backup-agent` führt PostgreSQL-Backups für die explizit angeforderten Ziele `staging` und `prod` aus.
- Der Agent verwendet einen signierten, ereignisgetriggerten Auftrags- und Ergebnisvertrag. GitHub übergibt Aufträge über dedizierte, gehärtete Backup-Subdomains für Staging und Production; terminale Evidenz bleibt in MinIO. Der Agent akzeptiert keine beliebigen Shell-Kommandos.
- Jeder Auftrag ist an genau eine Umgebung, eine Request-ID und einen unveränderlichen Ziel-Digest gebunden. Der Agent wählt Datenbankzugang, Bucket und Credentials ausschließlich aus dieser validierten Umgebung.
- Der Agent erzeugt weiterhin Custom-Dumps, `.sha256`-Objekte und redigierte Schritt-Evidenz; GitHub wartet auf das Ergebnisobjekt und blockiert Migration, Bootstrap und Deploy bei jedem nicht erfolgreichen Nachweis.
- Production-Aufträge benötigen zusätzlich den bestehenden revisionsfähigen Wartungsfenster-Verweis sowie die Freigabe des GitHub-Production-Environments.
- Der zentrale Agent wird als bewusst breite Vertrauenszone dokumentiert: Er ist mit beiden internen Netzen sowie ausschließlich für seinen Ingress mit dem bestehenden Traefik-Netz verbunden und besitzt getrennte, jeweils umgebungsspezifische Datenbank- und MinIO-Secrets.
- Nach erfolgreicher Betriebsabnahme ersetzt der Agent den temporären Backup-Stack im Promote-Pfad. Der bestehende temporäre Pfad bleibt bis dahin unverändert als Rückfall- und Vergleichspfad erhalten.

## Non-Goals

- Kein automatischer Datenbank-Restore oder Datenbank-Rollback.
- Kein allgemeiner Remote-Shell-, SQL- oder Kommandoausführungsdienst.
- Kein öffentlich erreichbares Backup-API und kein Ersatz für den bestehenden App- oder Migrations-Stack.
- Kein Wechsel der 180-Tage-Lifecycle-Regel für Backup- und Diagnoseobjekte.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: neuer zentraler Swarm-Service mit gehärtetem Trigger-Endpoint, Backup-Auftrags-/Ergebnisprotokoll, Traefik-Routing, `.github/workflows/promote.yml`, Staging-Backup-Drill, MinIO- und Runtime-Tests
- Affected documentation: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`, `docs/architecture/11-risks-and-technical-debt.md`, `docs/guides/swarm-deployment-runbook.md`
- Dependencies: Ergänzt `add-promote-backup-production-parity`; dessen Task 4.3 bleibt offen, bis der Agent in Staging und anschließend Production erfolgreich nachgewiesen ist.
