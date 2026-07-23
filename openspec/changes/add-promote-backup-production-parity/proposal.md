# Change: Datenbank-Backup und Production-Parität für Promote ergänzen

## Why

Staging kann Migrationen und Bootstrap bereits über gehärtete One-shot-Jobs ausführen, während Production für diese Modi noch fail-closed bleibt. Vor einer Production-Mutation fehlt außerdem ein repository-gesteuerter, nachweisbarer Datenbank-Backup-Schritt. Dadurch ist Staging kein vollständiger technischer Vorlauf für den späteren Production-Deploy.

## What Changes

- `Promote` erstellt für Staging und Production vor jedem angeforderten Migrations- oder Bootstrap-Job verpflichtend ein Postgres-Backup.
- Der Backup-Job verwendet einen isolierten temporären Swarm-Stack, schreibt einen PostgreSQL-Custom-Dump in den umgebungsspezifischen MinIO-S3-Bucket und prüft das hochgeladene Archiv vor der Mutation.
- Staging verwendet `studio-db-backup-staging`, Production `studio-db-backup-production`, jeweils über den S3-kompatiblen Endpoint `https://fileserver.smart-village.app`.
- Das Backup-Protokoll enthält ausschließlich sichere Metadaten wie Bucket, Objektpfad, Zeit, Größe, Prüfsumme und Prüfergebnis; Zugangsdaten und Datenbankinhalte bleiben ausgeschlossen.
- Production erhält dieselben expliziten One-shot-Modi wie Staging: Migration → optional Bootstrap → Postconditions → App-Deploy → interne und externe Verifikation.
- Production-Migrationen und -Bootstraps erfordern weiterhin einen nicht-sensitiven, revisionsfähigen Wartungsfenster-Verweis. Der Production-Digest muss zuvor in Staging erfolgreich verifiziert worden sein.
- Ein erfolgreicher mutierender Staging-Promote schreibt dafür eine redigierte Digest-Evidenz; Production verwendet ausschließlich diese Evidenz als Paritätsnachweis.
- Vor der Betriebsabnahme wird für beide Backup-Buckets eine dokumentierte Lifecycle-Regel konfiguriert. Ein Restore-Drill bleibt ausdrücklich außerhalb dieses Changes.

## Non-Goals

- Kein automatisches Deployment von `main` nach Production.
- Kein automatisches Datenbank-Rollback.
- Kein vollständiger Restore-Drill bei jedem Deploy; ein separater Restore-Drill bleibt Folgearbeit.
- Keine Ablage von Datenbankdumps als GitHub-Artifact oder im Repository.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: `.github/workflows/promote.yml`, One-shot-Job-Renderer und -Tests, Compose-Definitionen für Backup-Jobs sowie Production-Deploy-Gates
- Affected documentation: `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/11-risks-and-technical-debt.md`, `docs/guides/swarm-deployment-runbook.md`
- Dependencies: Baut auf `update-staging-promote-one-shot-rollout` auf und wird erst nach dessen Integration umgesetzt.
