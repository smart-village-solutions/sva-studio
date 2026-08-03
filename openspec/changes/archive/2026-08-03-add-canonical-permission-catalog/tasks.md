## 1. Katalog und Verträge

- [x] 1.1 Kanonische Permission-Typen, Availability- und Lifecycle-Metadaten in einer neutralen Workspace-Schicht definieren
- [x] 1.2 Core-Permissions in den Katalog überführen und lokale Parallelkataloge entfernen
- [x] 1.3 Modul-IAM-Beiträge über die bestehende Modulvertragsfamilie in die Katalogsicht integrieren
- [x] 1.4 Validatoren für Eindeutigkeit, Namespaces, Root-/Tenant-Isolation, Module und Default-Grants ergänzen

## 2. Persistenz und Reconcile

- [x] 2.1 Additiven, transaktionalen Repository-Reconcile für Permission-Definitionen und verwaltete `system_admin`-Grants implementieren
- [x] 2.2 Reconcile-Ergebnis mit sicheren Zählwerten und Audit-Evidenz modellieren
- [x] 2.3 Gezielte Permission-Snapshot-Invalidierung nach tatsächlichen Änderungen sicherstellen
- [x] 2.4 Automatische Löschungen sowie Änderungen an Custom-Rollen, manuellen Grants und Account-Rollenzuweisungen ausschließen

## 3. Lifecycle-Integration

- [x] 3.1 Tenant-Baseline und initialen Admin-Bootstrap an den Katalog-Reconcile anbinden
- [x] 3.2 Modulaktivierung und -deaktivierung an katalogisierte Definitionen und verwaltete Grants anbinden
- [x] 3.3 Expliziten IAM-Baseline-Reconcile für bestehende Tenants auf dieselbe Logik umstellen
- [x] 3.4 Veraltete direkte Permission-Arrays und redundante Seed-Definitionen entfernen

## 4. Tests und Gates

- [x] 4.1 Unit-Tests für Katalogvalidierung, Default-Grant und explizite Ausnahmen ergänzen
- [x] 4.2 Repository-Integrationstests für additive Upserts, Idempotenz und Non-Deletion ergänzen
- [x] 4.3 Lifecycle-Tests für neue Tenants, Modulaktivierung, Moduldeaktivierung und Re-Seed ergänzen
- [x] 4.4 Regressionstest für `iam.accounts.delete` auf `system_admin` ergänzen
- [x] 4.5 Betroffene Unit- und Type-Targets nach jedem Änderungsblock ausführen
- [x] 4.6 `pnpm check:server-runtime`, DB-Schema-/Migrationschecks und den kleinsten relevanten PR-Gate-Pfad ausführen

## 5. Dokumentation und Rollout

- [x] 5.1 ADR für kanonischen Permission-Katalog und additiven Reconcile erstellen
- [x] 5.2 Arc42-Abschnitte 04, 05, 06, 08 und 09 aktualisieren
- [x] 5.3 IAM-Autorisierungsmodell und Tenant-Bootstrap-Guide aktualisieren
- [x] 5.4 Katalogänderungs- und Deprecation-Verfahren dokumentieren
- [x] 5.5 Staging über den kanonischen Rollout aktualisieren und den Reconcile für `de-studio-sandbox` ausführen
- [x] 5.6 Effektive Permission `iam.accounts.delete`, Benutzer-Löschgate und Audit-/Snapshot-Evidenz live verifizieren
- [x] 5.7 Production mit demselben Image-Digest promoten und Reconcile-/IAM-Smokes dokumentieren
