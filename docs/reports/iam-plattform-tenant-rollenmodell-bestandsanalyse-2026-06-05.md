# IAM Plattform-/Tenant-Rollenmodell: Bestandsanalyse 2026-06-05

## Ziel

Diese Bestandsanalyse dokumentiert, welche tenantseitigen Altartefakte für das Zwei-Rollen-Zielbild relevant sind, welche davon durch die bestehenden Migrationspfade bereits neutralisiert werden und welche Restbestände weiterhin beobachtet oder manuell bereinigt werden müssen.

Zielbild des laufenden Refactorings:

- genau eine relevante Plattformrolle im Root-Realm: `instance_registry_admin`
- genau eine geschützte tenantlokale Default- und Vollzugriffsrolle: `system_admin`
- alle übrigen tenantlokalen Rollen werden individuell verwaltet und über Permissions statt über kanonische Standardrollen modelliert

## Quellenbasis

Die Analyse basiert auf folgenden bereits vorhandenen Artefakten im Repository:

- [0050_iam_platform_tenant_role_split.sql](../../../packages/data/migrations/0050_iam_platform_tenant_role_split.sql)
- [0051_iam_permission_gate_backfill.sql](../../../packages/data/migrations/0051_iam_permission_gate_backfill.sql)
- [0053_iam_legacy_standard_role_grant_cleanup.sql](../../../packages/data/migrations/0053_iam_legacy_standard_role_grant_cleanup.sql)
- [studio-db-schema.md](../development/studio-db-schema.md)
- [keycloak-tenant-realm-bootstrap.md](../guides/keycloak-tenant-realm-bootstrap.md)
- [ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md](../adr/ADR-046-plattform-vs-tenant-rollenmodell-und-legacy-standardrollen.md)

## Relevante Altbestände

### 1. Tenantseitige Root-Rolle `instance_registry_admin`

Dieser Altbestand ist fachlich falsch, weil `instance_registry_admin` nur im Root-Realm wirksam sein darf.

Betroffene Datenformen:

- Rollenzeilen in `iam.roles` mit `role_key = 'instance_registry_admin'` und `instance_id IS NOT NULL`
- direkte Benutzerzuweisungen in `iam.account_roles`
- Gruppenzuweisungen in `iam.group_roles`
- implizite Wirksamkeit über `instance.registry.manage`

Status:

- durch Migration `0050` als historischer Altbestand erkannt
- direkte Benutzer- und Gruppenzuweisungen werden entfernt
- die Rollenzeile selbst wird nicht gelöscht, sondern mit `[legacy-root-role-in-tenant]` markiert

Bewertung:

- bewusst additiver und nicht-destruktiver Migrationspfad
- kein Sollmodell mehr
- Restzeilen bleiben absichtlich als sichtbarer Migrationsinput erhalten

### 2. Früher geschützte tenantlokale Bootstrap-/Standardrollen

Folgende tenantseitigen Studio-Systemrollen werden im Zielbild nicht mehr als automatisch verwaltete Systemrollen geführt:

- `app_manager`
- `feature-manager`
- `interface-manager`
- `designer`
- `editor`
- `moderator`

Status:

- durch Migration `0050` erkannt, sofern `managed_by = 'studio'` und `is_system_role = true`
- `is_system_role` wird auf `false` gesetzt
- die Beschreibung wird mit `[legacy-bootstrap-role]` markiert

Bewertung:

- Rollen dürfen als historischer Altbestand weiter existieren
- sie sind nicht mehr normativer Bestandteil des Tenant-Sollmodells
- sie dürfen nicht wieder als Default-, Bootstrap- oder Schutzrollen in Runtime, Seeds oder UI zurückkehren

### 3. Tenantseitige Permission `instance.registry.manage`

Diese Permission darf tenantlokal keine Wirkung mehr entfalten.

Status:

- durch Migration `0050` aus `iam.role_permissions` entfernt
- Runtime- und UI-Gates werden parallel fail-closed auf Plattform- bzw. Tenant-Scope getrennt

Bewertung:

- Altbestand wird aktiv neutralisiert
- ist kein zulässiger tenantlokaler Berechtigungsanker mehr

### 4. Komfortartefakte `admins` und `core_admin`

Diese Artefakte sind keine Zielrollen des Zwei-Rollen-Modells, können aber in Bestandsinstanzen noch als implizite Vollzugriffs-Bündel vorkommen.

Status:

- nicht Bestandteil der strukturellen Datenmigration `0050`
- fachlich bereits aus dem Sollmodell herausgenommen
- Drift muss weiterhin diagnostisch beobachtet werden

Bewertung:

- kein Blocker für den aktuellen Schema-/Migrationspfad
- weiterhin relevanter Restbestand für Repair- und Drift-Reporting

### 5. Nicht im aktuellen Cleanup-Scope: `mainserver_editor`

Die Rolle `mainserver_editor` taucht weiterhin in Seeds auf und ist bewusst nicht Teil der Legacy-Bereinigung aus `0050`.

Einordnung:

- es handelt sich nicht um eine frühere kanonische Tenant-Standardrolle des bisherigen IAM-Sollmodells
- die Rolle dient als Studio-verwaltete Integrations-/Bootstrap-Rolle für den externen SVA-Mainserver
- sie ist deshalb gesondert zu bewerten und darf nicht mit den entfernten Standardrollen gleichgesetzt werden

Bewertung:

- aktuell kein Widerspruch zum Zwei-Rollen-Zielbild
- nur dann ein Folge-Thema, wenn diese Rolle künftig ebenfalls als fachlich normative Defaultrolle missbraucht würde

## Abdeckung durch bestehende Migrationspfade

### Migration `0050_iam_platform_tenant_role_split.sql`

Diese Migration deckt den Kern der Altbestands-Neutralisierung bereits ab:

- identifiziert betroffene Instanzen über tenantseitige `instance_registry_admin`-Rollen, frühere Studio-Systemrollen und die Permission `instance.registry.manage`
- entfernt direkte Account- und Group-Zuordnungen zur tenantseitigen Root-Rolle
- entfernt tenantseitige Grants für `instance.registry.manage`
- markiert tenantseitige `instance_registry_admin`-Rollen mit `[legacy-root-role-in-tenant]`
- entzieht den früheren Standardrollen den Status `is_system_role = true`
- markiert diese Rollen mit `[legacy-bootstrap-role]`
- invalidiert Permission-Snapshots betroffener Instanzen per `pg_notify`

Wichtig:

- die Migration löscht keine Rollenzeilen
- dadurch bleibt der Pfad rollback- und repair-fähig
- die Altbestände bleiben sichtbar, aber verlieren ihre normative Wirkung

### Migration `0051_iam_permission_gate_backfill.sql`

Diese Migration ergänzt den Zielzustand auf der Permission-Seite:

- legt fehlende tenantlokale Governance-/Legal-/Monitoring-Permissions additiv an
- bindet diese Permissions an `system_admin` sowie optionale Governance-Rollen
- stabilisiert damit die Permission-basierte Gate-Auswertung nach dem Rückbau früherer Standardrollen

Wichtig:

- `0051` ersetzt keine Legacy-Rollen direkt
- `0051` reduziert aber das Risiko, dass Altrollen nur deshalb weitergeschleppt werden, weil `system_admin` noch nicht vollständig genug ausgestattet wäre

### Migration `0053_iam_legacy_standard_role_grant_cleanup.sql`

Diese Follow-up-Migration schließt die Lücke für bereits migrierte Bestandsdatenbanken:

- entfernt historisch geseedete Sidebar-, Governance- und Experimental-Grants gezielt von früheren tenantlokalen Standardrollen
- wirkt nur auf Legacy-Rollenkeys und nur auf Seed-Zuordnungen, damit manuell gepflegte Berechtigungen nicht pauschal überschrieben werden
- invalidiert Permission-Snapshots betroffener Instanzen erneut

Wichtig:

- `0053` ersetzt keine strukturelle Löschung historischer Rollen
- `0053` verhindert aber, dass frühere Defaultrollen in hochgezogenen Umgebungen weiterhin implizite Standard- oder Vollzugriffs-Permissions behalten, obwohl frische Datenbanken diese Grants nicht mehr erhalten

### Additiver Keycloak-/Reconcile-Pfad im Laufzeitcode

Neben den DB-Migrationen ist auch der laufende Bootstrap- und Reconcile-Pfad bereits additiv auf das neue Zielmodell ausgerichtet:

- der Tenant-Bootstrap synchronisiert nur noch `system_admin` als geschützte Vollzugriffsrolle
- modulbezogene Permission-Synchronisation bereinigt nur modul-eigene Grants und materialisiert keine früheren Standardrollen erneut
- Reseed- und Follow-up-Pfade erzeugen keine Gruppe `admins`, keine Rolle `core_admin` und keine tenantseitige Rolle `instance_registry_admin`
- verbleibende Legacy-Artefakte bleiben damit Migrationsinput oder diagnostischer Drift, werden aber nicht mehr aus dem Happy Path heraus nachgebaut

Einordnung:

- die strukturelle Neutralisierung läuft additiv über `0050`, `0051` und das Upgrade-Follow-up `0053`
- der operative Reconcile-Pfad hält das Zielbild zur Laufzeit stabil, ohne destruktive Löschpflicht
- damit ist der Migrationspfad kompatibel mit Bestandsinstanzen, solange die verbleibenden Komfortartefakte über Drift-Erkennung und Runbook nachverfolgt werden

## Status der Tenant-Admin-Workflows

Die produktiv verdrahteten Tenant-Admin-Pfade sind bereits auf individuelle Rollen und Permission-Gates ausgerichtet:

- Benutzer-, Rollen- und Gruppenverwaltung prüfen im aktiven Auth-Runtime-Pfad tenantlokale Actions wie `iam.user.read`, `iam.user.write`, `iam.role.read` und `iam.role.write`
- die UI leitet Tenant-Admin-Zugriffe primär aus `permissionActions` ab und nicht aus kanonischen Rollennamen
- `instance_registry_admin` bleibt ausschließlich Plattformrolle für Root-/Instanzverwaltungsfunktionen
- `system_admin` bleibt nur dort als Sonderrolle sichtbar, wo Schutzsemantik fachlich beabsichtigt ist, etwa beim Letztadmin-Schutz oder bei geschützten Systemrollen

Einordnung:

- tenantlokale Fach- und Verwaltungszugriffe hängen normativ nicht mehr an Rollen wie `editor`, `designer` oder `app_manager`
- verbleibende Rollennamen-Prüfungen markieren Schutz- oder Plattformgrenzen und nicht mehr das allgemeine Tenant-Admin-Sollmodell

## Operative Prüf-Queries für Bestandsinstanzen

### Tenantseitige Root-Rollen finden

```sql
SELECT instance_id, id, role_key, managed_by, is_system_role, description
FROM iam.roles
WHERE instance_id IS NOT NULL
  AND role_key = 'instance_registry_admin'
ORDER BY instance_id, role_key;
```

### Direkte Benutzer- oder Gruppenzuordnungen auf tenantseitige Root-Rollen finden

```sql
SELECT 'account_roles' AS source, ar.instance_id, ar.role_id, ar.account_id::text AS target_id
FROM iam.account_roles ar
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE r.role_key = 'instance_registry_admin'
UNION ALL
SELECT 'group_roles' AS source, gr.instance_id, gr.role_id, gr.group_id::text AS target_id
FROM iam.group_roles gr
JOIN iam.roles r
  ON r.instance_id = gr.instance_id
 AND r.id = gr.role_id
WHERE r.role_key = 'instance_registry_admin'
ORDER BY instance_id, source;
```

### Frühere Studio-Systemrollen prüfen

```sql
SELECT instance_id, role_key, managed_by, is_system_role, description
FROM iam.roles
WHERE instance_id IS NOT NULL
  AND role_key IN (
    'app_manager',
    'feature-manager',
    'interface-manager',
    'designer',
    'editor',
    'moderator'
  )
ORDER BY instance_id, role_key;
```

### Tenantseitige Restgrants für `instance.registry.manage` prüfen

```sql
SELECT rp.instance_id, r.role_key, p.permission_key
FROM iam.role_permissions rp
JOIN iam.roles r
  ON r.instance_id = rp.instance_id
 AND r.id = rp.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE p.permission_key = 'instance.registry.manage'
ORDER BY rp.instance_id, r.role_key;
```

### Komfortbündel `admins` und `core_admin` als Drift-Indikatoren prüfen

```sql
SELECT instance_id, role_key, managed_by, is_system_role, description
FROM iam.roles
WHERE instance_id IS NOT NULL
  AND role_key = 'core_admin'
UNION ALL
SELECT instance_id, group_key AS role_key, group_type AS managed_by, is_active AS is_system_role, description
FROM iam.groups
WHERE instance_id IS NOT NULL
  AND group_key = 'admins'
ORDER BY instance_id, role_key;
```

## Risiko- und Reparaturbewertung

### Was der aktuelle Pfad gut absichert

- keine destruktive Löschung historischer Rollenartefakte
- klare Markierung von Altbeständen direkt an den betroffenen Rollen
- Permission-Snapshots werden nach Migrationen aktiv invalidiert
- `system_admin` wird parallel über `0051` auf die aktuelle Permission-Basis gehoben

### Was bewusst noch offen bleibt

- Restbestände in Gruppen wie `admins` oder Rollen wie `core_admin` werden noch nicht automatisiert bereinigt
- tenantseitig verbleibende Legacy-Rollen werden diagnostisch sichtbar gemacht, aber nicht automatisch gelöscht
- Bestandsinstanzen brauchen zusätzlich einen dokumentierten Repair-/Rollback-Pfad für manuelle Nacharbeiten

## Fazit

Die aktuelle Migrationsstrategie ist mit dem Zielbild kompatibel und bricht bestehende Pfade nicht blind auf. Sie arbeitet bewusst additiv:

- tenantseitige `instance_registry_admin`- und `instance.registry.manage`-Artefakte werden neutralisiert
- frühere geschützte Standardrollen werden als Legacy markiert und aus dem Systemrollenmodell entfernt
- `system_admin` wird als normative tenantlokale Vollzugriffsrolle parallel funktional abgesichert

Für die verbleibenden Folgearbeiten sind jetzt vor allem die tenantlokalen Admin-Workflows und die Verifikation relevant:

- Verifikations- und E2E-Pfade für Root-Control-Plane und tenantlokale Rollenverwaltung ergänzen
