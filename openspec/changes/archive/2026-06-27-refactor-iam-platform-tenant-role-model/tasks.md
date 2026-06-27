> Umsetzungsstand 2026-06-05: Der Zwei-Rollen-Schnitt ist in den Kernpfaden umgesetzt; Spezifikation, Seeds, Modulverträge und zentrale Guards werden auf `instance_registry_admin` plus `system_admin` konsolidiert. Historische Cleanup-Migrationen für Bestandsrollen bleiben ausdrücklich Bestandteil des Migrationspfads.

## 1. Spezifikation und Architektur
- [x] 1.1 OpenSpec-Deltas für `iam-core`, `iam-access-control`, `instance-provisioning` und `account-ui` finalisieren und validieren
- [x] 1.2 betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `09` aktualisieren
- [x] 1.3 ADR für die Trennung von Plattform-/Tenant-Rollenmodell und geschützten Sonderrollen ergänzen

## 2. Plattform- und Tenant-Scope trennen
- [x] 2.1 Plattform-User- und Plattform-Rollenprojektion auf `instance_registry_admin` als einzig relevante Root-Rolle reduzieren
- [x] 2.2 Tenant-seitige Seeds, Personas und Runtime-Konstanten von `instance_registry_admin` bereinigen
- [x] 2.3 Root-/Tenant-Guards in Runtime, IAM-Admin und UI auf getrennte Scope-Prüfungen umstellen

## 3. Tenant-Provisioning und Bootstrap bereinigen
- [x] 3.1 Tenant-Admin-Bootstrap im Tenant-Realm nur noch auf `system_admin` ausrichten
- [x] 3.2 Keycloak-Status-, Preflight- und Provisioning-Projektionen ohne tenantseitiges `instance_registry_admin` aktualisieren
- [x] 3.3 Root-Control-Plane-Checks und Tenant-IAM-Checks diagnostisch getrennt halten
- [x] 3.4 Bootstrap-, Repair- und Reseed-Pfade so ausrichten, dass `system_admin` immer die vollständige tenantlokale Permission-Menge direkt aus der kanonischen Permission-Quelle erhält
- [x] 3.5 Root-Bootstrap-/Follow-up-Pfade auf Modulfreigaben plus `system_admin` begrenzen und verbleibende Legacy-Admin-Strukturen aus dem Happy Path entfernen

## 4. Modul-IAM von Standardrollen entkoppeln
- [x] 4.1 `@sva/studio-module-iam` auf permission-zentrierte Verträge umstellen
- [x] 4.2 modulbezogene IAM-Seeding- und Repair-Pfade auf Permission-Basis stabilisieren
- [x] 4.3 `system_admin` als deterministisches Permission-Superset aus derselben Modul- und Core-Permission-Quelle zusammensetzen
- [x] 4.4 Legacy-Standardrollen aus Entwicklungs-Seeds, Modulverträgen und Tests entfernen

## 5. Tenant-Admin-Workflows auf individuelle Rollen/Gruppen ausrichten
- [x] 5.1 Rollen- und Benutzerverwaltung von kanonischen Standardrollen lösen
- [x] 5.2 Guards für Fachzugriffe wo möglich auf Permissions statt Rollennamen umstellen
- [x] 5.3 `instance.registry.manage` aus tenantfähigen UI- und API-Pfaden entfernen
- [x] 5.4 Gruppen wie `admins` oder Rollen wie `core_admin` nicht mehr als versteckte Voraussetzung für vollen Tenant-Admin-Zugriff behandeln

## 6. Datenmigration und Kompatibilität
- [x] 6.1 Bestandsanalyse für tenantseitige `instance_registry_admin`- oder modulgekoppelte Standardrollen erstellen
- [x] 6.2 additive Migrationspfade für Datenbank und Keycloak-Reconcile implementieren
- [x] 6.3 Drift zwischen `system_admin` und bestehenden Admin-Gruppen/-Rollen erkennen und reparierbar machen
- [x] 6.4 Repair-/Rollback-Runbook dokumentieren

## 7. Verifikation
- [x] 7.1 relevante Unit-, Typ-, Runtime- und affected-Gates definieren und dokumentieren
- [x] 7.2 End-to-End-Szenarien für Root-Control-Plane, Tenant-Admin-Bootstrap und tenantlokale Rollenverwaltung ergänzen
- [x] 7.3 `openspec validate refactor-iam-platform-tenant-role-model --strict` und den kleinsten relevanten Nx-Gate-Pfad ausführen
