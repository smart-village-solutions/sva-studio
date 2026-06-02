# Studio-DB-Schema

## Ziel

Dieses Dokument ist der schnelle Einstieg für Entwickler, die den aktuellen Aufbau der Studio-Datenbank verstehen wollen.

Es kombiniert:

- den **Live-Stand** der Datenbank `sva_studio` aus dem produktionsnahen Stack `studio`
- die **Repo-Quelle** der erwarteten Struktur aus `packages/data/migrations/`

## Aktueller Stand

- Erhebungsdatum: `2026-05-08`
- Endpoint: `sva`
- Stack: `studio`
- Service: `postgres`
- Datenbank: `sva_studio`
- Live-Dump: `artifacts/db-schema/studio-live-schema-2026-05-08.sql`
- Finaler Soll-Snapshot aus Migrationen: `docs/development/studio-db-schema-final.sql`
- Finaler Soll-Snapshot zuletzt lokal aktualisiert: `2026-05-20`
- Migrationen im Repo: `packages/data/migrations/*.sql`

### Zusammenfassung

- Der Live-Dump enthält aktuell **47 Tabellen**.
- Davon liegen **46 Tabellen im Schema `iam`**.
- Zusätzlich existiert `public.goose_db_version` als Migrationshistorie.
- Der aktuelle Repo-Soll-Snapshot enthält **54 Tabellen**.
- Davon liegen **53 Tabellen im Schema `iam`**.
- Im Live-Schema sind aktuell mindestens diese DB-Funktionen vorhanden:
  - `iam.check_geo_hierarchy_depth()`
  - `iam.current_instance_id()`
  - `iam.prevent_activity_logs_mutation()`
  - `iam.prevent_platform_activity_logs_mutation()`

## Wichtig: aktueller Drift zwischen Live und Repo

Der Live-Stand ist derzeit **nicht vollständig identisch** zum aktuellen Repo-Stand.

- Live-DB laut `goose_db_version`: `37`
- Repo-Migrationen vorhanden bis: `0048_iam_organization_mainserver_credentials.sql`

Konkret fehlen im Live-Dump aktuell mindestens diese Repo-Änderungen aus `0038` bis `0042`:

- auf `iam.role_permissions` die Ownership-/Origin-Felder `grant_origin_kind` und `grant_origin_module_id` samt Check-Constraints und Index `idx_role_permissions_origin_module`
- auf `iam.role_permissions` das Assignment-Scope-Feld `access_scope` samt Constraint `role_permissions_access_scope_check`
- die Tabellen `iam.plugin_operation_jobs` und `iam.plugin_operation_job_events` sowie die ergänzten Runtime-Felder aus `0040_plugin_operation_job_runtime_fields.sql`
- der External-Interface-Katalog mit `iam.external_interface_types` und `iam.instance_external_interfaces`
- die tenantbezogenen Löschregel-Tabellen `iam.instance_deletion_rules` und `iam.account_deletion_content_preferences`
- die Lifecycle-Spalten `last_login_at`, `deletion_lifecycle_state`, `deactivated_at`, `pseudonymized_at`, `deletion_marked_at` auf `iam.accounts`
- die Content-Lifecycle-Spalten `deletion_lifecycle_state` und `deletion_lifecycle_changed_at` auf `iam.contents`

Für Entwicklungsentscheidungen gilt deshalb:

- **Live-Stand** ist maßgeblich für tatsächliches Laufzeitverhalten.
- **Migrationen im Repo** sind maßgeblich für den Soll-Zustand.

## Finaler Soll-Stand aus dem Repo

Zusätzlich zum Live-Dump liegt ein reproduzierter Soll-Snapshot auf Basis der Repo-Migrationen im finalen Stand vor:

- Datei: `docs/development/studio-db-schema-final.sql`
- Quelle: lokaler Postgres-Reset + vollständige Anwendung von `packages/data/migrations/*.sql`
- Enthält explizit die Repo-Migrationen bis `0048_iam_organization_mainserver_credentials.sql`
- Aktueller Soll-Stand: **54 Tabellen**, davon **53 im Schema `iam`**

Der Snapshot bildet damit den erwarteten Zielschema-Stand des Repositories ab, auch wenn das Livesystem noch hinterherhängt.

## Schema-Übersicht nach Domänen

### 1. IAM-Kernmodell

Zentrale Identitäts- und Berechtigungsstruktur:

- `iam.instances`
- `iam.accounts`
- `iam.organizations`
- `iam.organization_mainserver_credentials`
- `iam.roles`
- `iam.permissions`
- `iam.instance_memberships`
- `iam.account_organizations`
- `iam.account_roles`
- `iam.role_permissions`

Kernidee:

- `instances` ist der Mandantenanker.
- `accounts` hält Nutzerstammdaten.
- `organizations` modelliert fachliche Organisationsstrukturen pro Instanz.
- `organization_mainserver_credentials` hält organisationsgebundene Mainserver-Application-IDs und verschlüsselte Secrets getrennt vom normalen Organisations-Read-Modell.
- Rollen und Rechte werden über `account_roles` und `role_permissions` zugewiesen.
- `role_permissions.access_scope` ergänzt für datensatzbezogene Rechte den Zugriffsmodus einer Rollen-Rechte-Zuordnung (`all`, `own`, `organization`).

### `iam.organization_mainserver_credentials`

Speichert organisationsgebundene Mainserver-Zugangsdaten pro `instance_id` und `organization_id`.

- `mainserver_application_id` ist im Read-Modell sichtbar.
- `mainserver_application_secret_ciphertext` enthält ausschließlich verschlüsselte Werte.
- API- und UI-Modelle geben nie das Secret zurück, sondern nur `mainserverApplicationSecretSet: boolean`.

### 2. Gruppen und direkte Rechte

Erweiterungen für feinere Berechtigungssteuerung:

- `iam.groups`
- `iam.group_roles`
- `iam.account_groups`
- `iam.account_permissions`

Kernidee:

- Gruppen bündeln Rollen.
- Nutzer können zusätzlich direkte Rechte über `account_permissions` erhalten.

### 3. Governance, Audit und Compliance

Tabellen für Nachvollziehbarkeit, Freigaben und DSGVO-nahe Prozesse:

- `iam.activity_logs`
- `iam.activity_logs_archive`
- `iam.platform_activity_logs`
- `iam.permission_change_requests`
- `iam.delegations`
- `iam.impersonation_sessions`
- `iam.instance_deletion_rules`
- `iam.account_deletion_content_preferences`
- `iam.legal_text_versions`
- `iam.legal_text_target_roles`
- `iam.legal_text_target_groups`
- `iam.legal_text_acceptances`
- `iam.legal_holds`
- `iam.data_subject_requests`
- `iam.data_subject_request_events`
- `iam.data_subject_export_jobs`
- `iam.data_subject_recipient_notifications`
- `iam.account_profile_corrections`

Kernidee:

- Audit-Tabellen sind unveränderlich abgesichert.
- Governance- und Datenschutzflüsse sind relational nachvollziehbar modelliert.
- Tenantbezogene Löschregeln, die einfache Inhaltsstrategie (`retain` oder `with_owner_lifecycle`) sowie der Tenant-Schalter für erlaubte Nutzer-Overrides werden explizit relational gespeichert.
- Für V1-Löschregeln bleibt der fachlich führende letzte Login dennoch die Aggregation aus `iam.activity_logs` (`MAX(created_at)` für erfolgreiche `login`-Events mit `result = 'success'`); `iam.accounts.last_login_at` ist im aktuellen Scope nicht die primäre Read-Modell-Quelle.
- `iam.permission_change_requests` unterstützt zusätzlich einen Self-Service-Intake mit Freitextbegründung und Ursprung (`admin` oder `self_service`).

### 4. Organisation, Geo und Scope

Strukturen für geografische und organisatorische Einordnung:

- `iam.geo_nodes`
- `iam.geo_hierarchy`
- `iam.geo_units`

Kernidee:

- `geo_nodes` und `geo_hierarchy` bilden eine Closure-Table-Struktur.
- `geo_units` hält fachlich nutzbare Geo-Einheiten für Scopes und Zuordnungen.

### 5. Instanz- und Provisioning-Modell

Tabellen für Instanzkonfiguration, Hostnames und technische Provisionierung:

- `iam.instance_integrations`
- `iam.external_interface_types`
- `iam.instance_external_interfaces`
- `iam.instance_modules`
- `iam.instance_hostnames`
- `iam.instance_provisioning_runs`
- `iam.instance_audit_events`
- `iam.instance_keycloak_provisioning_runs`
- `iam.instance_keycloak_provisioning_steps`

Kernidee:

- Diese Tabellen modellieren die technische Betriebs- und Provisioning-Ebene pro Instanz.
- Externe Schnittstellen werden hostgeführt über einen zentralen Typkatalog und instanzbezogene Konfigurationsdatensätze mit verschlüsselten Secret-Blöcken verwaltet.
- Keycloak-bezogene Zustände sind explizit persistiert und auditierbar.

### 6. Content-Management

Host-seitiges Kernmodell für Inhalte:

- `iam.contents`
- `iam.content_history`

Kernidee:

- `contents` hält den aktuellen Stand.
- `content_history` hält Historisierung und Änderungsverlauf.
- `contents` trägt zusätzlich einen eigenen Lösch-Lifecycle-Zustand, damit tenantweite Account-Löschregeln in V1 referenzwahrend auf Inhalte abgebildet werden können.

### 7. Media-Management

Kernmodell für hochgeladene und referenzierte Medien:

- `iam.media_assets`
- `iam.media_variants`
- `iam.media_references`
- `iam.media_upload_sessions`
- `iam.media_storage_usage`
- `iam.media_storage_quotas`

Kernidee:

- Assets, Varianten, Upload-Sessions und Referenzen sind getrennt modelliert.
- Speicherverbrauch und Limits werden relational pro Instanz geführt.

### 8. Technische Hilfs- und Betriebsdaten

- `iam.idempotency_keys`
- `public.goose_db_version`

Kernidee:

- `idempotency_keys` schützt mutierende Abläufe gegen Wiederholung.
- `goose_db_version` dokumentiert den tatsächlich angewendeten Migrationsstand.

### 9. Externe Waste-Fachdatenbank

Die instanzbezogene Waste-Fachdatenbank ist technisch von der zentralen IAM-/Governance-Persistenz getrennt. Für die im Studio verwalteten Touren und Terminlogiken ist insbesondere folgende `waste_*`-Tabellenfamilie relevant:

- `waste_tours`
- `waste_custom_recurrence_presets`
- `waste_location_tour_links`
- `waste_location_tour_pickup_dates`
- `waste_tour_date_shifts`
- `waste_global_date_shifts`

Kernidee:

- `waste_tours` bleibt das führende Tourmodell und trägt weiterhin `first_date`, `end_date` und `custom_dates`.
- `waste_custom_recurrence_presets` hält instanzbezogene zusätzliche Tagesabstände mit Name, optionaler Beschreibung und positiver Tagesanzahl.
- `waste_tours.custom_recurrence_id` referenziert optional ein solches Preset; feste Default-Turnusse bleiben parallel über `recurrence` erhalten.
- Datumsverschiebungen und ortsbezogene Zuordnungen bleiben in ihren bestehenden Tabellen und wenden die aufgelöste Tourserie lediglich fachlich an.

## Wichtige Beziehungen

- Fast alle fachlichen Tabellen hängen direkt oder indirekt an `iam.instances`.
- Multi-Tenancy wird überwiegend über `instance_id` modelliert.
- Row-Level-Security ist für viele `iam`-Tabellen aktiv und Teil des Sicherheitsmodells.
- `accounts` ist der zentrale Referenzpunkt für Nutzer in Rollen-, Gruppen-, Audit- und Compliance-Tabellen.
- `media_*` und `content_*` sind nicht separat in eigenen Schemas isoliert, sondern aktuell ebenfalls unter `iam` angesiedelt.

## Wo man ins Detail schaut

- Vollständiger Live-SQL-Dump:
  - `artifacts/db-schema/studio-live-schema-2026-05-08.sql`
- Vollständiger Soll-SQL-Dump im finalen Repo-Stand:
  - `docs/development/studio-db-schema-final.sql`
- Erwarteter Soll-Stand über Migrationen:
  - `packages/data/migrations/`
- Einstieg in die erste Basismigration:
  - `packages/data/migrations/0001_iam_core.sql`
- Aktuell noch nicht live angewendete Repo-Migration:
  - `packages/data/migrations/0038_iam_role_permission_ownership.sql`

## Refresh des Live-Dumps

Der aktuelle Dump wurde lokal read-only per Quantum CLI aus dem laufenden `studio`-Postgres erzeugt.

Beispiel:

```bash
mkdir -p artifacts/db-schema

TERM=dumb quantum-cli exec \
  --endpoint sva \
  --stack studio \
  --service postgres \
  --slot 1 \
  -c "sh -lc 'pg_dump --schema-only --no-owner --no-privileges -U \"sva\" -d \"sva_studio\" </dev/null'" \
  | perl -pe 's/\e\[[0-9;?]*[ -\/]*[@-~]//g; s/\0//g' \
  | sed '/^time=/d' \
  > artifacts/db-schema/studio-live-schema-YYYY-MM-DD.sql
```

Danach sollte zusätzlich geprüft werden:

```bash
TERM=dumb quantum-cli exec \
  --endpoint sva \
  --stack studio \
  --service postgres \
  --slot 1 \
  -c "sh -lc 'psql -X -q -At -F \"|\" -U \"sva\" -d \"sva_studio\" -c \"SELECT version_id, is_applied FROM goose_db_version ORDER BY id DESC LIMIT 5;\" </dev/null'" \
  | perl -pe 's/\e\[[0-9;?]*[ -\/]*[@-~]//g; s/\0//g' \
  | sed '/^time=/d;/^$/d'
```

## Refresh des finalen Soll-Snapshots

Der Soll-Snapshot wird lokal aus einem sauberen Postgres-Stand erzeugt:

```bash
pnpm nx run data:db:reset
pnpm nx run data:db:up
pnpm nx run data:db:migrate

export PGPASSWORD="${PGPASSWORD:?lokales DB-Passwort setzen}"

pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  -h 127.0.0.1 \
  -p 5432 \
  -U sva \
  -d sva_studio \
  > docs/development/studio-db-schema-final.sql
```

## Nächste sinnvolle Ausbaustufen

- Vergleich Live-Dump gegen `packages/data/migrations/` automatisieren
- ER-Darstellung oder tabellarische Spaltenübersicht aus dem Live-Dump generieren
- Drift-Gate für `studio` definieren, damit fehlende Migrationen früher sichtbar werden
