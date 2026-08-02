# ADR-049: Kanonischer Permission-Katalog und additiver Reconcile

- Status: Accepted
- Datum: 2026-08-02

## Kontext

Core-Permissions, Modul-Permissions und Grants der geschützten Tenant-Rolle `system_admin` wurden bislang in Seeds, Runtime-Baselines und einzelnen Migrationen parallel gepflegt. Dadurch konnte ein später angelegter Tenant trotz ausgeführter Migration unvollständig sein, wie bei `iam.accounts.delete`.

## Entscheidung

`@sva/core` führt die typsicheren Core-Definitionen einschließlich Availability, Lifecycle und Default-Grant. `@sva/studio-module-iam` komponiert daraus und aus den bestehenden Modulverträgen die validierte Gesamtsicht `studioPermissionCatalog`.

Aktive tenantweite Permissions und Permissions zugewiesener Module werden standardmäßig an `system_admin` vergeben. Abweichungen sind explizit als `systemAdminGrant: false` beziehungsweise `systemAdminPermissionExclusions` zu deklarieren. Root-Permissions sind von diesem Default ausgeschlossen.

Der Tenant-Reconcile verwendet `(instance_id, permission_key)` als natürliche Identität, legt fehlende Definitionen und verwaltete Grants idempotent an und aktualisiert fachliche Metadaten. Katalogentfernung oder Deprecation löschen weder Permission-Zeilen noch manuelle Grants oder Custom-Rollen. Ein destruktiver Cleanup benötigt einen eigenen Change und eine eigene Migration.

Moduldeaktivierung darf ausschließlich eindeutig als `module_sync` markierte Grants entfernen; die Permission-Definition bleibt erhalten. Schema-Migrationen bleiben von der additiven Katalogdatenpflege getrennt.

## Konsequenzen

- Eine neue tenantweite Permission benötigt nur Katalogeintrag, Tests, Review und den kontrollierten Reconcile im regulären Rollout.
- Neue und bestehende Tenants verwenden dieselbe fachliche Quelle.
- Reconcile-Auditdaten weisen sichere Zähler für eingefügte, aktualisierte und unveränderte Definitionen und Grants aus.
- Deprecated Daten bleiben absichtlich erhalten, bis ein explizit freigegebener Cleanup erfolgt.

## Alternativen

Handgeschriebene SQL-Migrationen pro Permission verhindern keine Drift zukünftiger Runtime-Baselines. Generierte Migrationen würden einen zweiten Snapshotzustand schaffen. Beide Varianten wurden daher für normale additive Katalogänderungen verworfen.
