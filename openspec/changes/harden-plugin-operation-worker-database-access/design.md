## Context

Graphile Worker ist eine austauschbare interne Runner-Implementierung. Der HTTP-Prozess startet derzeit jedoch den Runner mit dem allgemeinen IAM-Datenbank-Pool und ruft davor `runMigrations()` auf. In Production koppelt dies einen normalen Request an privilegiertes DDL und verhindert das Einreihen, wenn `sva_app` das Schema `graphile_worker` nicht anlegen oder aktualisieren darf.

## Goals / Non-Goals

- Goals:
  - Graphile-DDL ausschließlich im privilegierten Promote-Migrationsschritt ausführen
  - App- und Worker-Datenbankzugriffe durch getrennte Principals und Pools begrenzen
  - App-Starts und Jobstarts ohne implizite Datenbankmigrationen ermöglichen
  - fehlende Migrationen oder Grants vor dem App-Deploy fail-closed erkennen
- Non-Goals:
  - Graphile Worker ersetzen
  - einen neuen öffentlichen Plugin- oder Jobvertrag einführen
  - fachliche Jobhandler oder deren Retry-Verhalten verändern

## Decisions

- Decision: Der Migrations-One-shot führt `graphileWorker.runMigrations()` mit dem bestehenden privilegierten PostgreSQL-Principal aus und reconciliert anschließend die expliziten Queue-Grants.
- Decision: `sva_app` bleibt fachlicher Zugriffsträger für die zentralen Studio-Jobdatensätze, besitzt im internen `graphile_worker`-Schema aber ausschließlich `USAGE` und `EXECUTE` auf einen migrationsverwalteten, eingabevalidierenden `SECURITY DEFINER`-Wrapper mit festem `search_path`; der privilegierte Migrationsprincipal besitzt die Schemaobjekte und den Wrapper.
- Decision: Der Runner verwendet einen eigenen Pool aus `STUDIO_JOB_WORKER_DATABASE_URL` oder den abgeleiteten Worker-Zugangsdaten und fällt in produktionsnahen Profilen nicht auf `IAM_DATABASE_URL` zurück.
- Decision: App und Provisioner dürfen denselben Worker-Principal verwenden, bleiben aber über die bestehende Default-/Privileged-Lane fachlich getrennt. Ein separater Worker-Service ist für diesen Fix nicht erforderlich.
- Decision: Bootstrap legt beziehungsweise rotiert den Worker-Login idempotent an, entzieht überbreite Datenbank-DDL-Rechte des App-Principals und prüft die erwarteten Grants.
- Decision: Weil Graphile Worker seine internen Tabellen mit Row-Level Security schützt, erhält der dedizierte Worker ausschließlich schema-lokale Policies auf den RLS-aktivierten Graphile-Tabellen; ein globales `BYPASSRLS`-Attribut bleibt ausgeschlossen.
- Alternatives considered: Weiterhin Runtime-Migration mit `sva_app`; verworfen wegen überbreiter Rechte und requestgekoppeltem DDL. Separater Worker-Service; fachlich sauber, aber für die Principal-Trennung nicht erforderlich und mit zusätzlicher Betriebsownership verbunden.

## Risks / Trade-offs

- Graphile Worker kann seine internen SQL-Verträge zwischen Versionen ändern → Migration und Grant-Verifikation werden an die im Image gebundene Version gekoppelt und durch Integrationstests abgesichert.
- Ein fehlendes Worker-Secret verhindert den App- oder Provisioner-Start → produktionsnahe Profile validieren die Konfiguration fail-closed vor dem Deploy.
- Ein App-Rollback kann ein neueres Queue-Schema sehen → der Change verändert Graphile nicht auf eine neue Hauptversion und hält das Schema rückwärtskompatibel zum aktuellen Image-Fenster.

## Migration Plan

1. Neues Worker-Secret in Dev, Staging und Production bereitstellen.
2. Den Staging-Promote mit `migration_mode=run` und `bootstrap_mode=run` ausführen.
3. Postconditions für Graphile-Schema, App-Enqueue und Worker-Verarbeitung prüfen.
4. Denselben Digest nach erfolgreichem Backup und Staging-Nachweis nach Production promoten.
5. Bei App-Problemen auf den vorherigen Digest zurückrollen; die additive Rolle und das bestehende Graphile-Schema bleiben kompatibel.

## Open Questions

- Keine
