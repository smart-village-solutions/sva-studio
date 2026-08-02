# Waste-Cutover von Supabase auf die Tenant-Datenbank

## Zweck und Grenze

Dieses Runbook beschreibt die einmalige Offline-Migration der vorhandenen Supabase-Waste-Datenbank ausschließlich für `bb-prignitz`. Die Zieldatenbank wird zuvor durch die normale Aktivierung von `waste-management` provisioniert. Das Runbook legt weder Datenbank noch Interface manuell an und führt keinen zweiten Studio-Rolloutpfad ein; Deployments folgen ausschließlich dem [Studio-Rollout-Prozess](./studio-rollout-process.md).

Ein verlustfreier Rückwechsel ist nur möglich, solange nach dem finalen Dump keine Schreibzugriffe auf der neuen Zieldatenbank freigegeben wurden. Nach der Freigabe wäre jeder Rückwechsel eine neue Datenmigration. Die Supabase-Quelle bleibt anschließend 14 Tage unverändert und schreibgeschützt.

## Einmalige Vorbereitung

1. Den regulären Studio-Rollout mit Migration `0074_iam_waste_tenant_provisioning.sql`, privilegierter Worker-Lane und dem externen Secret `studio_waste_database_provisioner_password_v1` abschließen.
2. `waste-management` für `bb-prignitz` aktivieren und warten, bis der Status `ready` ist. Datenbank, Rollen und pluginverwaltetes Interface entstehen automatisch.
3. In der zentralen Studio-Datenbank prüfen, dass genau ein Ziel registriert ist:

   ```sql
   SELECT instance_id, status, database_name, completed_generation
   FROM iam.instance_waste_provisioning
   WHERE instance_id = 'bb-prignitz';
   ```

4. Eine geschützte libpq-Service-Datei mit drei Einträgen vorbereiten:

   - `waste-supabase-source`: rotierter Supabase-Datenbankzugang,
   - `studio-admin`: zentrale Studio-Datenbank mit Leserecht auf die Waste-Registry,
   - `waste-bb-prignitz-target`: die vom Provisionierer erzeugte tenantbezogene Migrationsrolle und Zieldatenbank.

   Passwörter liegen ausschließlich in einer Passwortdatei mit Modus `0600`; sie dürfen weder in Shell-Historie noch in Prozessargumenten stehen.

5. Den freien Speicher auf dem PostgreSQL-Host in Bytes ermitteln. Der Migrationslauf verlangt mindestens das Dreifache der finalen Dump-Größe für Dump, Restore und Sicherheitsreserve.
6. Einen regulären Waste-Backup-Auftrag ausführen. Das Ergebnis muss ein Manifest unter `<umgebung>/waste/inventory/` und einen Eintrag für `bb-prignitz` unter `<umgebung>/waste/bb-prignitz/` enthalten.

## Offline-Fenster

Am vereinbarten Sonntag werden über den bestehenden Betriebsweg Studio-App, öffentliche Waste-App und relevante Worker gestoppt. Ein eigener Wartungsmodus ist nicht vorgesehen. Vor dem Dump müssen folgende Prüfungen leer sein:

```sql
SELECT id, status
FROM iam.studio_jobs
WHERE instance_id = 'bb-prignitz'
  AND plugin_id = 'waste-management'
  AND status IN ('queued', 'running', 'retrying');
```

```sql
SELECT pid, usename, application_name
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();
```

Die erste Abfrage läuft in `sva_studio`, die zweite auf der Supabase-Quelle. Bei einem Treffer wird nicht gedumpt.
Das Einmalskript wiederholt diese Prüfung maschinenlesbar für offene Waste-Jobs
sowie aktive Fremdsitzungen auf Quelle und Ziel und bricht vor dem Dump ab. Rein
inaktive PostgreSQL-Plattformsitzungen werden dabei nicht als Schreibverkehr
gewertet.

## Preflight und Import

Das Skript ist hart an `bb-prignitz` gebunden. Es verweigert den Import, wenn Registry-Datenbank, tatsächliche Zieldatenbank oder Migrationsrolle abweichen. Vor der ersten Mutation prüft es außerdem:

- Quellserver- und `pg_dump`-Hauptversion,
- benötigte PostgreSQL-Erweiterungen,
- vollständiges, leeres und bereits provisioniertes Zielschema,
- freien Zielspeicher,
- ein lesbares Custom-Dump-Archiv.

```bash
export SOURCE_PGSERVICE=waste-supabase-source
export SOURCE_PG_BIN=/opt/homebrew/opt/postgresql@17/bin
export STUDIO_PGSERVICE=studio-admin
export TARGET_PGSERVICE=waste-bb-prignitz-target
export WASTE_TENANT_INSTANCE_ID=bb-prignitz
export WASTE_TARGET_AVAILABLE_BYTES='<vorab ermittelter Wert>'
export WASTE_MIGRATION_DIR='<leeres Verzeichnis mit Modus 0700>'

scripts/ops/migrate-waste-postgresql.sh
```

`SOURCE_PG_BIN` muss auf einen Client zeigen, dessen Hauptversion mindestens der Supabase-Quellversion entspricht. Die lokale PostgreSQL-Serverinstanz muss dafür nicht gewechselt werden. Der Import überträgt ausschließlich Daten aus `public.waste_*` in das durch die versionierten Waste-Migrationen vorbereitete Schema; Owner und Supabase-ACLs werden nicht übernommen.

## Verifikation und Evidenz

Der Lauf vergleicht Tabelleninventar und Zeilenzahlen. Zusätzlich sind fachliche Stichproben für Regionen, Orte, Touren, Termine, Einstellungen und Reminder-Daten durchzuführen. Anschließend:

1. den Waste-Reconcile-/Migrationsjob für `bb-prignitz` erneut ausführen,
2. Status `ready` und erfolgreiche Studio-/Public-Rechteproben prüfen,
3. Studio-Smoke für lesenden und schreibenden Waste-Zugriff ausführen,
4. Public-Waste-Smoke mit der tenantbezogenen Public-Rolle ausführen,
5. einen Registry-basierten Backup-Lauf und den Workflow **Waste Database Restore Drill** mit `tenant_instance_id: bb-prignitz` erfolgreich abschließen.

Das geschützte Evidenzverzeichnis enthält mindestens:

- `waste-source.dump` und `waste-source.contents`,
- `waste-data.sql` und `waste-data-target.sql`,
- Quell-/Zielinventar, Tabellen- und Erweiterungslisten,
- `sha256sums.txt`,
- `migration-evidence.json` mit Instanz, registrierter Datenbank, Versionen, Größen und Zeitmarke.

Es enthält keine Passwörter oder Verbindungs-URLs und wird nicht ins Git-Repository aufgenommen.

## Freigabe und Rückfall

Erst nach allen erfolgreichen Prüfungen werden Studio, Worker und die öffentliche Waste-App wieder gestartet. Das allgemeine Interface bleibt für Nutzer unsichtbar; der Runtime-Resolver verwendet ausschließlich das aktive pluginverwaltete Interface von `bb-prignitz`.

Bis zur Freigabe erfolgt ein Rückfall durch erneuten Stopp aller Runtimes und Wiederanlauf mit der unveränderten Supabase-Quelle. Der fehlgeschlagene PostgreSQL-Zielstand bleibt isoliert zur Analyse erhalten. Nach der Freigabe bleibt Supabase 14 Tage schreibgeschützt als Vergleichsquelle; tägliche Read-Smokes, Jobfehler, Reminder-Outbox und tenantgenaue Backups werden kontrolliert. Die endgültige Supabase-Stilllegung benötigt eine separate Freigabe.
