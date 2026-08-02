## 1. Verträge und Registry

- [x] 1.1 Generischen External-Interface-Typ `postgresql` mit verschlüsselter `databaseUrl`, optionalem `schemaName` und PostgreSQL-Healthcheck ergänzen.
- [x] 1.2 Registry-, API-, UI-, Übersetzungs- und Validierungsverträge für `postgresql` implementieren und testen; `supabase` unverändert erhalten.
- [x] 1.3 Zentrale Studio-DB-Migration ergänzen und `docs/development/studio-db-schema-final.sql` sowie `docs/development/studio-db-schema.md` aktualisieren.

## 2. Waste-Runtimes entkoppeln

- [x] 2.1 Waste-Datenquellenresolver und Settings auf die ausgewählte PostgreSQL-Schnittstelle umstellen und Supabase-Pflichtfelder entfernen.
- [x] 2.2 Host-Fassade, Connection-Status, Pooling sowie Migrations- und Jobpfade mit PostgreSQL-Verträgen testen.
- [x] 2.3 Public-Waste-App auf denselben PostgreSQL-Vertrag umstellen und Konfigurationsbeispiele sowie Runtime-Checks anpassen.
- [ ] 2.4 Unit-, Type-, Server-Runtime- und relevante E2E-/Integrationstests nach jedem Änderungsblock ausführen.

## 3. Betrieb und Datensicherheit

- [x] 3.1 `sva_waste` sowie `sva_waste_owner`, `sva_waste_migrator`, `sva_waste_app` und `sva_waste_public_app` mit minimalen Rechten reproduzierbar für die kanonischen Umgebungen provisionieren.
- [x] 3.2 Backup- und Restore-Abläufe um die Waste-Fachdatenbank erweitern und mit einem Restore-Drill nachweisen.
- [ ] 3.3 Kontrollierten Stopp von Studio-App, Public-Waste-App und Waste-Worker sowie Job- und Datenbanksitzungs-Drain für das Sonntagsfenster festlegen und testen; keinen neuen Anwendungs-Wartungsmodus einführen.
- [x] 3.4 Maschinenlesbare Vorher-/Nachher-Verifikation für Schemaobjekte, Migrationen und Zeilenzahlen bereitstellen.

## 4. Einmaliger Cutover

- [x] 4.1 Deutsches Cutover-Runbook mit Sonntagsfenster, Betriebsstopp, Preflight, Dump, Restore, Verifikation, Umschaltung, Smoke-Tests, Rollback-Gate und 14-tägiger Aufbewahrungsfrist unter `docs/guides/` dokumentieren.
- [x] 4.2 Quellinventar der vorhandenen Supabase-Datenbank ohne Secret- oder PII-Offenlegung erstellen und migrationsrelevante Abweichungen dokumentieren.
- [x] 4.3 Trockenlauf gegen eine isolierte Ziel-Datenbank durchführen und die Verifikationskriterien nachweisen.
- [ ] 4.4 Produktiven Offline-Cutover durchführen und den umgebungsspezifischen Nachweis unter `docs/staging/YYYY-MM/` beziehungsweise `docs/reports/` ablegen.
- [ ] 4.5 Supabase nach Freigabe der Zielschreibzugriffe 14 Tage schreibgeschützt als Vergleichs- und Notfallquelle erhalten; einen späteren Rückwechsel als neue Datenmigration behandeln und die Stilllegung separat bestätigen.

## 5. Dokumentation und Gates

- [x] 5.1 Arc42-Abschnitte `03`, `05`, `07`, `08` und `11` auf PostgreSQL-Zielbild, Datenbankgrenze, Backup und Cutover-Risiken aktualisieren.
- [x] 5.2 Public-Waste-, Schnittstellen-, lokale Betriebs- und Rollout-Dokumentation aktualisieren, ohne einen konkurrierenden Studio-Deploypfad einzuführen.
- [ ] 5.3 Kleinste relevante Unit-/Type-/Runtime-Gates, `pnpm check:file-placement` und vor PR-Freigabe bevorzugt `pnpm test:pr` ausführen; ausgelassene breite Gates transparent dokumentieren.
