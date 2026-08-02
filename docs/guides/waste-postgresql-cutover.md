# Waste-Cutover von Supabase auf PostgreSQL

## Ziel und Sicherheitsgrenze

Dieses Runbook beschreibt die einmalige Offline-Migration der vorhandenen Waste-Datenbank nach `sva_waste` auf der Studio-PostgreSQL-Instanz. Es führt keinen zweiten Studio-Rolloutpfad ein; Deployments folgen weiterhin ausschließlich dem [Studio-Rollout-Prozess](./studio-rollout-process.md).

Ein verlustfreier Rückwechsel zur Supabase-Quelle ist nur möglich, solange nach dem finalen Dump keine Schreibzugriffe auf `sva_waste` freigegeben wurden. Nach der Freigabe ist jeder Rückwechsel eine neue Datenmigration. Die Supabase-Quelle bleibt anschließend 14 Tage unverändert und schreibgeschützt.

## Vorbereitung

1. Ein geschütztes Arbeitsverzeichnis auf verschlüsseltem Speicher anlegen. Dumps und Inventare dürfen nicht ins Repository gelangen.
2. Eine libpq-Service-Datei mit den Einträgen `waste-supabase-source` und `waste-local-target` sowie eine Passwortdatei mit Modus `0600` vorbereiten. Passwörter dürfen weder in Shell-Historie noch in Prozessargumenten stehen.
3. Mit einem PostgreSQL-Administrator die Rollen und Datenbank anlegen:

   ```bash
   export WASTE_MIGRATOR_PASSWORD='...'
   export WASTE_APP_PASSWORD='...'
   export WASTE_PUBLIC_APP_PASSWORD='...'
   psql service=studio-admin --file=deploy/portainer/postgres-init/20-create-waste-database.sql
   ```

4. Erreichbarkeit vom Studio-Netz und vom externen Overlay-Netz `studio_internal` prüfen. Die öffentliche Runtime verwendet `sva_waste_public_app`; Studio und Waste-Worker verwenden `sva_waste_app`; Migrationen verwenden ausschließlich `sva_waste_migrator`.
   Das kanonische Studio-Profil erlaubt private Ziele ausschließlich für serverseitige Schnittstellen-Healthchecks über `SVA_ALLOW_PRIVATE_INTERFACE_HEALTHCHECK_TARGETS=true`.
5. Die vier Waste-Backup-/Restore-Secrets am zentralen Agenten bereitstellen, dessen aktualisiertes Image ausrollen und einen signierten Staging-Auftrag mit `database: "waste"` ausführen. Der Workflow **Waste Database Restore Drill** restauriert dieses Artefakt ausschließlich nach `sva_waste_restore_drill` und prüft Schema sowie beide Runtime-Rollen. Erst nach erfolgreichem Drill `WASTE_POSTGRES_BACKUP_ENABLED=true` im jeweiligen GitHub Environment setzen; ab dann sichern Promote sowie Staging-/Production-Backup-Drill `sva_studio` und `sva_waste` fail-closed nacheinander.
6. In Supabase ohne Ausgabe von Daten oder Secrets inventarisieren: PostgreSQL-Version, Extensions, Schemas, Tabellen, Sequenzen, Constraints, Indizes, Funktionen, RLS-Policies, Owner und Grants. Abweichungen vom erwarteten `public.waste_*`-Modell im Cutover-Protokoll festhalten.

## Sonntagsfenster

### 1. Offline-Grenze herstellen

Über den bestehenden Betriebsweg die Replikate von Studio-App, Public-Waste-App und Waste-Worker auf null setzen. Es wird kein Anwendungs-Wartungsmodus eingeführt. Danach müssen folgende Prüfungen leer sein:

```sql
SELECT id, status FROM iam.plugin_operation_jobs
WHERE plugin_id = 'waste-management' AND status IN ('queued', 'running');

SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND (state <> 'idle' OR backend_type = 'client backend');
```

Die erste Abfrage läuft in der Studio-Datenbank, die zweite auf der Supabase-Quelle. Bei einem Treffer wird nicht gedumpt.

### 2. Dump, Restore und Vergleich

Die Zieldatenbank muss ein leeres, durch die versionierten Waste-Migrationen vorbereitetes Schema enthalten. Die Supabase-Quelle läuft auf PostgreSQL 17, die Swarm-Zielinstanz auf PostgreSQL 16. Das Werkzeug führt deshalb keinen Schema-Downgrade durch: Es erzeugt mit einem PostgreSQL-17-Client ein vollständiges Custom-Sicherungsarchiv der `public.waste_*`-Tabellen und überträgt die Fachdaten getrennt in das vorbereitete PostgreSQL-16-Schema. Bei jedem Export-, Import- oder Vergleichsfehler bricht es ab.

```bash
export PGSERVICEFILE=/geschützter/pfad/pg_service.conf
export PGPASSFILE=/geschützter/pfad/pgpass
export SOURCE_PGSERVICE=waste-supabase-source
export TARGET_PGSERVICE=waste-local-target
export WASTE_MIGRATION_DIR=/geschützter/leerer/pfad/cutover-YYYYMMDD
export SOURCE_PG_BIN=/opt/homebrew/opt/postgresql@17/bin
scripts/ops/migrate-waste-postgresql.sh
```

`SOURCE_PG_BIN` muss auf einen Client zeigen, dessen Hauptversion mindestens der Supabase-Quellversion entspricht. Der Pfad oben gilt für die parallele Homebrew-Installation auf macOS; es ist kein Wechsel des aktiven lokalen PostgreSQL-Dienstes erforderlich.

Nach dem Datenimport die idempotenten Waste-Migrationen erneut ausführen. Dieser zweite Lauf überführt importierte Legacy-Abholtermine in die aktuellen Assignment-Tabellen und ergänzt neue technische Tabellen. Anschließend als Administrator Owner und Runtime-Rechte normalisieren:

```bash
psql service=studio-admin --file=deploy/portainer/postgres-init/21-grant-waste-runtime-access.sql
```

Die erzeugten Dateien `source-inventory.json`, `target-inventory.json`, `waste-source.dump`, `waste-source.contents`, `waste-data.sql`, `waste-data-target.sql` und `sha256sums.txt` bilden den maschinenlesbaren Nachweis. Sie gehören in den geschützten Betriebsnachweis, nicht ins Git-Repository. Das Custom-Archiv und `waste-data.sql` bleiben unveränderte Quellartefakte; nur `waste-data-target.sql` ist für den transaktionalen Import in PostgreSQL 16 bestimmt.

### 3. Konfiguration und Smoke-Tests

1. Im Studio eine Schnittstelle vom Typ `PostgreSQL` mit der URL der Rolle `sva_waste_app` und Schema `public` anlegen, Connection-Test ausführen und als Waste-Schnittstelle auswählen.
2. `PUBLIC_WASTE_DATABASE_URL` auf `sva_waste_public_app` und `PUBLIC_WASTE_SCHEMA_NAME` auf `public` setzen.
3. Ausstehende Waste-Migrationen über den bestehenden Waste-Migrationsjob ausführen.
4. Runtimes intern starten, aber den öffentlichen Router noch nicht freigeben.
5. Stammdaten, Standortauflösung, Kalender, PDF und iCal lesen. Über Studio einen kontrollierten Datensatz in einer Transaktion schreiben und zurückrollen. Falls Erinnerungen aktiv sind, DOI, Abmeldung, Materialisierung und Outbox mit Testdaten prüfen.
6. Connection-Status beider Runtimes, Waste-Migrationsstand und das zentrale Backup kontrollieren.

### 4. Freigabe oder Rollback

Sind alle Pflichtprüfungen grün, werden Studio, Worker und öffentlicher Router freigegeben. Der Zeitpunkt dieser ersten möglichen Zielschreiboperation beendet das verlustfreie Rollback-Gate.

Vor diesem Zeitpunkt erfolgt ein Rollback durch erneuten Stopp aller drei Runtimes, Rücksetzen der Studio-Waste-Schnittstelle und der Public-Waste-Verbindung auf Supabase sowie anschließenden Neustart. Der fehlgeschlagene Zielstand bleibt isoliert zur Analyse erhalten.

## Nachlauf

- Supabase unmittelbar nach Freigabe schreibgeschützt setzen und 14 Tage weder verändern noch löschen.
- In diesem Zeitraum tägliche Read-Smokes, Jobfehler, Reminder-Outbox und Backup-Erfolg prüfen.
- Den produktiven Nachweis ohne Secrets oder PII unter `docs/reports/` ablegen.
- Nach 14 fehlerfreien Tagen die Supabase-Stilllegung separat freigeben und dokumentieren.
