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
- Finaler Soll-Snapshot zuletzt lokal aktualisiert: `2026-06-03`
- Migrationen im Repo: `packages/data/migrations/*.sql`

### Zusammenfassung

- Der Live-Dump enthält aktuell **47 Tabellen**.
- Davon liegen **46 Tabellen im Schema `iam`**.
- Zusätzlich existiert `public.goose_db_version` als Migrationshistorie.
- Der aktuelle Repo-Soll-Snapshot enthält weiterhin die komplette IAM-Struktur und zusätzlich runtime-nahe `waste_*`-Tabellen für Pickup-Date-Notizen sowie öffentliche E-Mail-Erinnerungen.
- Im Live-Schema sind aktuell mindestens diese DB-Funktionen vorhanden:
  - `iam.check_geo_hierarchy_depth()`
  - `iam.current_instance_id()`
  - `iam.prevent_activity_logs_mutation()`
  - `iam.prevent_platform_activity_logs_mutation()`

## Wichtig: aktueller Drift zwischen Live und Repo

Der Live-Stand ist derzeit **nicht vollständig identisch** zum aktuellen Repo-Stand.

- Live-DB laut `goose_db_version`: `37`
- Repo-Migrationen vorhanden bis: `0058_waste_email_reminders.sql`

Konkret fehlen im Live-Dump aktuell mindestens diese Repo-Änderungen aus `0038` bis `0053`:

- auf `iam.role_permissions` die Ownership-/Origin-Felder `grant_origin_kind` und `grant_origin_module_id` samt Check-Constraints und Index `idx_role_permissions_origin_module`
- auf `iam.role_permissions` das Assignment-Scope-Feld `access_scope` samt Constraint `role_permissions_access_scope_check`
- die Tabellen `iam.studio_jobs` und `iam.studio_job_events`, das Quellfeld `source` für Host- und Plugin-Jobs sowie die Verknüpfung `iam.data_subject_export_jobs.studio_job_id` aus `0049_studio_jobs_and_dsr_export_worker.sql`
- die additive Datenbereinigung aus `0050_iam_platform_tenant_role_split.sql`, die tenantseitige Legacy-Artefakte für `instance_registry_admin`, `instance.registry.manage` und frühere geschützte Bootstrap-Standardrollen neutralisiert, ohne das relationale Schema zu verändern
- die additive Permission-Erweiterung aus `0051_iam_permission_gate_backfill.sql` und `0052_iam_experimental_shell_permission.sql`
- das Upgrade-Follow-up `0053_iam_legacy_standard_role_grant_cleanup.sql`, das historisch geseedete Standard-Grant-Reste auf früheren tenantlokalen Bootstrap-Rollen entfernt, ohne das relationale Schema zu verändern
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
- Enthält strukturell den Repo-Sollstand bis `0058_waste_email_reminders.sql`; `0050` bis `0053` sind daten- beziehungsweise permissionseitig, `0058` ergänzt drei runtime-nahe Waste-Tabellen für DOI- und Reminder-Persistenz
- Aktueller Soll-Stand umfasst die IAM-Tabellen, `public.goose_db_version` sowie die runtime-nah dokumentierten `waste_*`-Tabellen im finalen Snapshot

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

### 2. Gruppen und Rollenrechte

Erweiterungen für feinere Berechtigungssteuerung:

- `iam.groups`
- `iam.group_roles`
- `iam.account_groups`

Kernidee:

- Gruppen bündeln Rollen.
- Nutzer erhalten Rechte ausschließlich über Rollen- und Gruppen-Zuordnungen.
- Effektive Rechte sind Allow-Grants; explizite `deny`-Effekte und direkte Account-Permissions sind nicht Teil des Zielmodells.

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
- `iam.instance_waste_data_sources`
- `iam.instance_modules`
- `iam.instance_hostnames`
- `iam.instance_provisioning_runs`
- `iam.instance_audit_events`
- `iam.instance_confirmation_challenges`
- `iam.instance_keycloak_provisioning_runs`
- `iam.instance_keycloak_provisioning_steps`

Kernidee:

- Diese Tabellen modellieren die technische Betriebs- und Provisioning-Ebene pro Instanz.
- Externe Schnittstellen werden hostgeführt über einen zentralen Typkatalog und instanzbezogene Konfigurationsdatensätze mit verschlüsselten Secret-Blöcken verwaltet.
- Die instanzspezifische Waste-Datenquelle bleibt als eigener technischer Datensatz im IAM-Schema modelliert und folgt demselben `instance_id`-basierten Isolationvertrag.
- Keycloak-bezogene Zustände sind explizit persistiert und auditierbar.
- Kritische Maschinenaktionen verwenden kurzlebige Einmal-Challenges, die atomar an Instanz, Akteur, Action, optionales Modul und Zustandsfingerprint gebunden sind, höchstens einmal verbraucht werden und ausschließlich den Phrase-Hash speichern.

### 6. Content-Management

Host-seitiges Kernmodell für Inhalte und ihre führende Listenprojektion:

- `iam.contents`
- `iam.content_history`
- `iam.content_list_projection`
- `iam.content_list_projection_sync_state`

Kernidee:

- `contents` hält den aktuellen Stand lokaler IAM-Inhalte.
- `content_history` hält Historisierung und Änderungsverlauf.
- `content_list_projection` ist das persistierte führende Read-Model für `/admin/content`; lokale IAM-Inhalte werden triggerbasiert gespiegelt, Mainserver-Typen serverseitig materialisiert. `projection_scope_key` trennt materialisierte Snapshots je Sichtbarkeits-Scope, damit derselbe Mainserver-Datensatz für unterschiedliche Organisationen oder Benutzer-Sichten parallel materialisiert werden kann.
- `content_list_projection_sync_state` hält den letzten erfolgreichen beziehungsweise fehlgeschlagenen Refresh-Lauf pro Instanz, Mainserver-Content-Typ und `sync_scope_key`; dadurch bleiben Scope-spezifische Snapshots und ihre Refresh-Metadaten voneinander isoliert.
- `contents` trägt zusätzlich einen eigenen Lösch-Lifecycle-Zustand, damit tenantweite Account-Löschregeln in V1 referenzwahrend auf Inhalte abgebildet werden können.
- Für privilegierten Admin-Hard-Delete dürfen `author_account_id`, `creator_account_id`, `updater_account_id` und `content_history.actor_account_id` referenzwahrend auf `NULL` fallen.
- Die übrigen bewusst blockierenden `ON DELETE RESTRICT`-Pfade bleiben unverändert und müssen im Runtime-Flow als Konflikt behandelt werden. Betroffen sind weiterhin DSR-, Governance-, Delegations-, Impersonation- und Korrekturpfade, etwa für Zielaccounts, Delegationsbeziehungen, Permission-Requests oder Profilkorrekturen.
- `owner_user_id` und `owner_organization_id` sind die kanonischen Ownership-Spalten für Scope-Prüfungen (`own`, `organization`, `all`) und werden in `content_list_projection` gespiegelt.
- `author_display_mode` (`organization` oder `user`) steuert die fachliche sichtbare Autorenanzeige; `author_display_name` bleibt der persistierte Anzeige-Snapshot.
- `source_data_provider_id`, `source_data_provider_name` und `credential_source` beschreiben bei Mainserver-Projektionen die externe Veröffentlichungsidentität und verwendete Credential-Quelle. Diese Felder setzen keine IAM-Ownership.
- `owner_subject_id` bleibt nur noch Legacy-Kompatibilitätsfeld und ist nicht mehr maßgeblich für Autorisierung.

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

Die instanzbezogene Waste-Fachdatenbank ist technisch von der zentralen IAM-/Governance-Persistenz getrennt. Der kanonische migrationsbasierte Studio-Snapshot unter `docs/development/studio-db-schema-final.sql` dokumentiert inzwischen den runtime-nahen Sollzustand für die bereits angebundenen `waste_*`-Tabellen.

Kernidee:

- Waste-Fachtabellen gelten nur dann als Teil des kanonischen Studio-Snapshots, wenn sie auch über `packages/data/migrations/*.sql` reproduzierbar erzeugt werden.
- Fachliche oder externe Waste-Schemata außerhalb dieses Migrationspfads dürfen nicht stillschweigend im Soll-Snapshot oder in CI-Gates auftauchen.
- Für den aktuellen Stand sind `waste_location_tour_pickup_dates` sowie die neuen Tabellen `waste_email_reminder_subscriptions`, `waste_email_reminder_subscription_items` und `waste_email_reminder_outbox` explizit in diesen migrationsbasierten Sollstand aufgenommen.

Für den aktuellen Waste-PDF-Export-Shift ist wichtig:

- Das verpflichtende Fraktionskürzel `waste_fractions.pdf_short_label` gehört zur externen Waste-Fachdatenbank, nicht zur zentralen Studio-DB; Legacy-Daten werden im runtime-nahen Waste-Migrationspfad deterministisch aus Fraktionsname oder ID backfilled.
- Die Reminder-Konfiguration der externen Tabelle `waste_fractions` verwendet dort `reminder_config JSONB` als Source of Truth; die früheren Flachspalten (`reminder_count`, `first_reminder_max_lead_days`, `second_reminder_max_lead_days`, `reminder_channel_*_enabled`) bleiben im runtime-nahen Schema nur als Migrationsquelle und Kompatibilitätsoberfläche erhalten.
- Die externe Tabelle `waste_location_tour_pickup_dates` enthält zusätzlich das optionale Feld `note TEXT` für terminbezogene Hinweise; dieser Task führt dafür zunächst die Schema- und Typoberfläche ein, die Anbindung in Repository, Import und UI folgt in späteren Tasks desselben Plans.
- Die öffentlichen E-Mail-Erinnerungen persistieren Pending- und aktive Abonnements in `waste_email_reminder_subscriptions`, die Fraktions-/Zeitfenster-Zuordnung in `waste_email_reminder_subscription_items` und DOI-/Reminder-Versandaufträge ressourcenschonend in `waste_email_reminder_outbox`.
- Der runtime-nahe Backfill in `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts` schreibt `reminder_config` deterministisch aus den Legacy-Spalten und überschreibt vorhandene JSON-Konfigurationen nicht.
- Die zugehörige Schemaquelle liegt aktuell im runtime-nahen Waste-Migrationspfad unter `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`.
- `calendarWebUrl` bleibt Teil von `iam.instance_external_interfaces.public_config` in der zentralen Studio-DB.
- Die PDF-Stamminhalte `pdfBrandingAssetUrl` und `pdfContactBlock` haben ihre führende Quelle dagegen im Waste-Schema der angebundenen Supabase-DB in `waste_settings`; die zentrale Studio-DB dient dafür nur noch als Legacy-Fallback älterer Bestandsdaten. Diese externe Tabelle gehört bewusst nicht zum IAM-/Goose-Migrationspfad der Studio-DB, sondern nur zum runtime-nahen Waste-Migrationspfad.

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
